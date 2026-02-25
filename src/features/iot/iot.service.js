const IoTModel = require('./iot.model');
require('../locality/locality.model');
const mockSensorReadings = require('../../shared/services/mockSensorReadings');
const { SENSOR_META, DATA_TYPE } = require('./utils/constants');
const { generateCSV } = require('./utils/dataExport.utils');
const { parsedDataFile } = require('./utils/dataImport.utils');
const {simpleLR, detectIntraBucketAnomalies, detectInterBucketAnomalies } = require('./utils/analytics.utils');
const { validateData, checkCriticalThreshold, checkSuddenChange } = require('./utils/alerts.utils');
const { setCache, getCache, clearCache, clearAllCache } = require('../../cache/redis-cache');
const crypto = require('crypto');

// for mocking real iot sensors
exports.generateMockReadings = async (localityId) => {
    const readings = [
        {
            localityId: localityId,
            sensorType: 'rainfall',
            value: mockSensorReadings.mockRainfall(),
            unit: 'mm',
        },
        {
            localityId: localityId,
            sensorType: 'humidity',
            value: mockSensorReadings.mockHumidity(),
            unit: '%',
        },
        {
            localityId: localityId,
            sensorType: 'temperature',
            value: mockSensorReadings.mockTemperature(),
            unit: '°C',
        },
        {
            localityId: localityId,
            sensorType: 'damWaterLevel',
            value: mockSensorReadings.mockDamWaterLevel(),
            unit: '%',
        },
    ];

    return IoTModel.insertMany(readings);
}

// ---- Actual Services ---- //

exports.insertReadings = async (localityId, readings) => {
    if (!readings || readings.length === 0) throw { status: 400, message: 'Sensor reading is empty' };

    const results = [];
    const errors = [];

    for (const data of readings) {
        try {
            const duplicate = await IoTModel.findOne({
                localityId,
                sensorType: data.sensorType,
                recordedAt: data.recordedAt,
            });

            if (duplicate) {
                errors.push({
                    sensorType: data.sensorType,
                    error: 'Reading already exist for this timestamp'
                });
                continue;
            }
            
            const validateResults = validateData(data.value, data.sensorType);
            if (!validateResults.valid) {
                errors.push({
                    sensorType: data.sensorType,
                    error: validateResults.reason
                });
                continue;
            }

            const reading = await IoTModel.create({
                localityId,
                sensorType: data.sensorType,
                value: data.value,
                unit: SENSOR_META[data.sensorType].unit,
                recordedAt: data.recordedAt || new Date(),
                source: data.source,
            });

            const alerts = await checkCriticalThreshold(reading);
            const suddenChangeAlert = await checkSuddenChange(reading);
            if (suddenChangeAlert) {
                alerts.push(suddenChangeAlert);
            }

            results.push({
                reading,
                alerts: alerts.length > 0 ? alerts : null,
            })
        } catch (err) {
            errors.push({
                sensorType: data.sensorType,
                error: err.message || 'Failed to process reading'
            })
        }
    } 
    
    return {
        success: results.length > 0,
        inserted: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : null,
    };
}

// wrapper
exports.insertReading = async (localityId, data) => {
    const result = await exports.insertReadings(localityId, [data]);
    
    if (result.failed > 0) {
        throw { status: 400, message: result.errors[0].error };
    }
    
    return result.results[0];
}

exports.getLatestReadings = async (user) => {
    const sensorTypes = [
        'rainfall',
        'humidity',
        'temperature',
        'damWaterLevel'
    ];

    const queries = sensorTypes.map(type =>
        IoTModel.find({ localityId: user.localityId, sensorType: type })
        .sort({ recordedAt: -1 })
        .limit(2) // get latest 2 readings
        .populate({ path: 'localityId', select: 'city province region' })
    )
    const docsArray = await Promise.all(queries);
    
    const results = {};
    let locality = null;

    docsArray.forEach(docs => {
        if (!docs || docs.length === 0) return;

        const latest = docs[0];
        const previous = docs[1];

        if (!locality && latest.localityId) {
            locality = latest.localityId;
        }

        let delta = null;
        let percentChange = null;

        if (previous) {
            delta = Math.abs(parseFloat((latest.value - previous.value).toFixed(2)));

            // avoid division by zero
            if (previous.value !== 0) {
                percentChange = parseFloat(((delta / previous.value) * 100).toFixed(2));
            }
        }

        const timeDifferenceMinutes = previous ? (new Date(latest.recordedAt) - new Date(previous.recordedAt)) / 1000 / 60 : null;

        results[latest.sensorType] = {
            value: latest.value,
            unit: latest.unit,
            recordedAt: latest.recordedAt,
            sensorType: SENSOR_META[latest.sensorType].label,
            delta, // actual difference between latest and previous value
            percentChange,
            previousValue: previous ? previous.value : null,
            previousRecordedAt: previous ? previous.recordedAt : null,
            timeDifferenceMinutes,
        };
    });

    const data = {
        locality,
        readings: results,
    };

    return data;
}

// cache entire query date range
exports.getHistory = async (localityId, sensorType, startDate, endDate, limit, cursor = 0) => {
    if (!sensorType || !startDate || !endDate) throw { status: 422, message: 'Missing query parameters' };

    // run date validations first before starting core logic
    // fail fast on invalid input
    const fromDate = new Date(startDate);
    const toDate = new Date(endDate);
    // date range query validations
    if (isNaN(fromDate) || isNaN(toDate)) throw { status: 400, message: 'Invalid date format' };
    if (fromDate >= toDate) throw { status: 400, message: 'Start date must be before end date' };
    // set max date range query to be lte 1year
    const MAX_RANGE_DAYS = 365;
    if ((toDate - fromDate) / (1000 * 60 * 60 * 24) > MAX_RANGE_DAYS) throw { status: 400, message: 'Date range too large' };

    fromDate.setUTCHours(0, 0, 0, 0);  // start of day UTC
    toDate.setUTCHours(23, 59, 59, 999); // end of day UTC

    const cacheKey = `${localityId}:history_${sensorType}:${startDate}_${endDate}`;
    let cached = getCache(cacheKey);

    if (!cached) {
        const query = {
            localityId,
            sensorType,
            recordedAt: { $gte: fromDate, $lte: toDate }
        };
        
        // fetch all data in query date range (for export)
        const allDocs = await IoTModel
            .find(query, { value: 1, recordedAt: 1 })
            .sort({ recordedAt: -1, _id: -1 })
            .lean();
        if (!allDocs || allDocs.length === 0) throw { status: 404, message: 'No available data for date range in database' };

        cached = {
            docs: allDocs,
            meta: {
                sensorType: SENSOR_META[sensorType].label,
                unit: SENSOR_META[sensorType].unit,
                dateRange: { fromDate, toDate }
            },
        };

        setCache(cacheKey, cached);
    }

    // ---- Pagination ---- //
    const start = Number(cursor) || 0;
    const pageData = cached.docs.slice(start, start + limit);
    const hasNext = start + limit < cached.docs.length;

    return {
        data: pageData,
        meta: cached.meta,
        pageInfo: {
            hasNext,
            nextCursor: hasNext ? start + limit : null
        }
    };
}

exports.getAnalytics = async (localityId, sensorType, startDate, endDate) => {
    if (!sensorType || !startDate || !endDate) throw { status: 422, message: 'Missing query parameters' };

    // run date validations first before starting core logic
    // fail fast on invalid input
    const fromDate = new Date(startDate);
    const toDate = new Date(endDate);
    // date range query validations
    if (isNaN(fromDate) || isNaN(toDate)) throw { status: 400, message: 'Invalid date format' };
    if (fromDate >= toDate) throw { status: 400, message: 'Start date must be before end date' };
    // set max date range query to be lte 1year
    const MAX_RANGE_DAYS = 365;
    if ((toDate - fromDate) / (1000 * 60 * 60 * 24) > MAX_RANGE_DAYS) throw { status: 400, message: 'Date range too large' };

    fromDate.setUTCHours(0, 0, 0, 0);  // start of day UTC
    toDate.setUTCHours(23, 59, 59, 999); // end of day UTC

    let granularity;
    const rangeDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    if (rangeDays <= 2) {
        granularity = 'hourly';
    } else if (rangeDays <= 90) {
        granularity = 'daily';
    } else {
        granularity = 'weekly'
    }

    const cacheKey = `${localityId}:analytics_${sensorType}:${startDate}_${endDate}`;
    let cached = getCache(cacheKey);
    if (cached) return cached;

    const dataPipeline = [
        {
            $match: {
                localityId,
                sensorType,
                recordedAt: { $gte: fromDate, $lte: toDate }
            }
        },
        {
            $group: {
                _id: { 
                    bucket: { 
                        $dateTrunc: {
                            date: '$recordedAt',
                            unit: granularity === 'hourly'
                                        ? 'hour'
                                        : granularity === 'daily'
                                            ? 'day'
                                            : 'week',
                            timezone: 'UTC'
                        } 
                    }
                },
                total: { $sum: '$value' },
                avg: { $avg: '$value' },
                min: { $min: '$value' },
                max: { $max: '$value' },
                stdDev: { $stdDevSamp: '$value' },
                values: { $push: '$value' }, // keep raw values
                count: { $sum: 1 },
            }        
        },
        { $sort: { '_id.bucket': 1 } },
        {
            $project: {
                bucket: '$_id.bucket',
                total: 1,
                avg: 1,
                min: 1,
                max: 1,
                stdDev: 1,
                values: 1,
                count: 1,
                _id: 0,
            }
        }
    ];

    const results = await IoTModel.aggregate(dataPipeline).exec();
    if (!results || results.length === 0) throw { status: 404, message: 'No available data for date range in database' };

    const unit = SENSOR_META[sensorType].unit;
    const series = results.map(r => {
        const values = r.values;
        const sorted = [...values].sort((a,b) => a-b);
        const mid = Math.floor(sorted.length / 2);

        const median = sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];

        const percentile25 = sorted[Math.floor(sorted.length * 0.25)];
        const percentile75 = sorted[Math.floor(sorted.length * 0.75)];

        return {
            timestamp: r.bucket,
            total: r.total,
            avg: r.avg,
            min: r.min,
            max: r.max,
            stdDev: r.stdDev,
            variance: r.stdDev ** 2,
            median,
            percentile25,
            percentile75,
            count: r.count,
            anomalies: [],
        }
    });

    series.forEach(bucket => {
        const intraAnomalies = detectIntraBucketAnomalies(bucket, sensorType);
        bucket.anomalies.push(...intraAnomalies);
    });
    detectInterBucketAnomalies(series, sensorType, granularity);
    const trendMetrics = simpleLR(series, sensorType)
    const anomalySummary = {
        total: 0,
        critical: 0,
        warning: 0,
        info: 0,
        types: {},
    };

    series.forEach(bucket => {
        if (bucket.anomalies && bucket.anomalies.length > 0) {
            bucket.anomalies.forEach(anomaly => {
                anomalySummary.total++;
                anomalySummary[anomaly.severity]++;
                anomalySummary.types[anomaly.type] = (anomalySummary.types[anomaly.type] || 0) + 1;
            });
        }
    });

    const analytics = {
        series,
        trend: trendMetrics,
        anomalies: anomalySummary,
        meta: {
            dateRange: { startDate: fromDate, endDate: toDate },
            granularity,
            unit,
            sensorType: SENSOR_META[sensorType].label,
            metric: 'average',
        }
    };
    setCache(cacheKey, analytics);

    return analytics;
}

// export service rely on cached history and analytics for export data
exports.exportData = async (localityId, category, sensorType, startDate, endDate, format = 'json', preview = false, previewLimit = 50) => {
    if (!sensorType || !startDate || !endDate || !category) throw { status: 422, message: 'Missing query parameters' };
    
    const cacheKey = `${localityId}:${category}_${sensorType}:${startDate}_${endDate}`;
    const cached = getCache(cacheKey);
    if (!cached) throw { status: 409, message: `No cached ${category} data available. Please load ${category} data first.` };

    try {
        let fileName;
        let data;

        if (category === 'analytics' && format === 'csv') throw { status: 400, message: 'Analytics export only supports JSON format' };

        // for analytics data
        if (category === 'analytics') {
            fileName = `${cached.meta.granularity}_${cached.meta.metric}_${sensorType}${cached.meta.unit}_${category}_${startDate}_${endDate}`
            data = {
                series: cached.series,
                trends: cached.trend,
                anomalies: cached.anomalies,
            }
            if (!data.series || data.series.length === 0) throw { status: 404, message: 'No available data for date range' };

            if (preview) data.series = data.series.slice(0, previewLimit);
            
        // for history data
        } else {
            fileName = `${sensorType}_${category}_${startDate}_${endDate}`;

            data = cached.docs;
            if (!data || data.length === 0) throw { status: 404, message: 'No available data for date range' };

            // preview in json format
            if (preview) data = data.slice(0, previewLimit);

            const csv = generateCSV(data, DATA_TYPE[category]);
            data = format === 'csv' ? csv.replace(/\n/g, '\r\n') : data;
        }

        return {
            data,
            fileName,
        }
    } catch (e) {
        throw (e);
    }
}

exports.importData = async (user, data, sensorType) => {
    if (!data || !sensorType) throw { status: 422, message: 'Missing parameters' };

    const importId = crypto.randomUUID();
    const cacheKey = `${user._id}_${importId}:import_data:${sensorType}`;

    try {       
        const parseResult = parsedDataFile(data, user.localityId, sensorType);
        const { data: cleanedRows, stats } = parseResult;

        if (cleanedRows.length === 0) throw { status: 400, message: 'No valid rows found' };

        // check for duplicates in database
        const timestamps = cleanedRows.map(row => row.recordedAt);

        const existing = await IoTModel.find({
            localityId: user.localityId,
            sensorType,
            recordedAt: { $in: timestamps }
        }, { recordedAt: 1 }).lean();

        const existingTimestamps = new Set(
            existing.map(e => e.recordedAt.getTime())
        );

        const newRows = cleanedRows.filter(row => !existingTimestamps.has(row.recordedAt.getTime()));
        const duplicateCount = cleanedRows.length - newRows.length;

        if (newRows.length === 0) throw { status: 400, message: 'All valid rows are duplicates', stats: { ...stats, duplicates: duplicateCount } };

        const rowsToImport = newRows.map(row => ({
            ...row,
            sensorType,
        }));

        setCache(cacheKey, rowsToImport);

        return { 
            meta: {
                importId,
                sensorType
            },
             summary: {
                totalRows: stats.total,
                validRows: stats.valid,
                invalidRows: stats.failed,
                duplicates: duplicateCount,
                readyToImport: rowsToImport.length
            },
            preview: {
                validRows: rowsToImport.slice(0, 25),
                invalidRows: stats.errors || []  // already limited to 10 in parsedDataFile
            }
        }
    } catch (e) {
        throw (e);
    }
}

exports.saveImport = async (importId, user, sensorType) => {
    if (!importId || !sensorType) throw { status: 422, message: 'Missing parameters' };

    const cacheKey = `${user._id}_${importId}:import_data:${sensorType}`;
    try {
        const cached = getCache(cacheKey);
        if (!cached || !cached.length) throw { status: 404, message: 'No matching import data found' };


        const result = await IoTModel.insertMany(cached);
        clearCache(cacheKey);

        return {
            success: true,
            imported: result.length,
            sensorType,
            message: `Successfully imported ${result.length} ${SENSOR_META[sensorType].label} readings`
        };
    } catch (e) {
        throw (e);
    }
}