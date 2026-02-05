const IoTModel = require('./iot.model');
require('../locality/locality.model');
const mockSensorReadings = require('../../shared/services/mockSensorReadings');
const { SENSOR_META, DATA_TYPE } = require('./utils/constants');
const { generateCSV } = require('./utils/dataExport.utils');
const { parsedDataFile, isValidHistoryRow, isValidAnalyticsRow } = require('./utils/dataImport.utils');
const {simpleLR, detectIntraBucketAnomalies, detectInterBucketAnomalies } = require('./utils/analytics.utils');
const { setCache, getCache, clearCache, clearAllCache } = require('../../cache/redis-cache');
const crypto = require('crypto');

// for mocking real iot sensors
exports.generateMockReadings = async (localityId) => {
    try {
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
    } catch (e) {
        throw (e)
    }
}


exports.getLatestReadings = async (user) => {
    const sensorTypes = [
        'rainfall',
        'humidity',
        'temperature',
        'damWaterLevel'
    ];

    try {
        const queries = sensorTypes.map(type =>
            IoTModel.find({ localityId: user.localityId, sensorType: type })
            .sort({ recordedAt: -1 })
            .limit(2) // get latest 2 readings
            .populate({ path: 'localityId', select: 'city province region' })
        )
        const docsArray = await Promise.all(queries);
        if (!docsArray) throw { status: 404, message: 'Displayed data is up to date' };
        
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
                delta = parseFloat((latest.value - previous.value).toFixed(2));

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
    } catch (e) {
        throw (e);
    }
}

// this service cache minimal info from expensive queries
// then hydrates what is needed with cheap DB calls
exports.getHistory = async (localityId, sensorType, startDate, endDate, limit, cursor = 0) => {
    if (!sensorType || !startDate || !endDate) throw { status: 422, message: 'Missing query parameters' };

    const cacheKey = `${localityId}:history_${sensorType}:${startDate}_${endDate}`;
    let cached = getCache(cacheKey);

     try {
        if (!cached) {
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

            const query = {
            localityId,
            sensorType,
            recordedAt: { $gte: fromDate, $lte: toDate }
            };

            const snaps = await IoTModel
            .find(query, { _id: 1, recordedAt: 1 })
            .sort({ recordedAt: -1, _id: -1 })
            .lean();
            if (!snaps) throw { status: 404, message: 'No valid data for date range in database' };

            cached = {
            snaps,
            meta: {
                sensorType: SENSOR_META[sensorType].label,
                unit: SENSOR_META[sensorType].unit,
                dateRange: { fromDate, toDate }
            },
            createdAt: Date.now()
            };

            setCache(cacheKey, cached);
        }

        // ---- Pagination ---- //
        
        const start = Number(cursor) || 0;
        const pageSnaps = cached.snaps.slice(start, start + limit);

        const docs = await IoTModel.find(
            { _id: { $in: pageSnaps.map(d => d._id) } },
            { value: 1, recordedAt: 1 }
        ).lean();
        if (!docs) throw { status: 404, message: 'No matching data found' }; 

        // re-ordering and sorting hydrated data
        const order = new Map(pageSnaps.map((d, i) => [d._id.toString(), i]));
        docs.sort((a, b) => order.get(a._id.toString()) - order.get(b._id.toString()));

        return {
            data: docs,
            meta: cached.meta,
            pageInfo: {
                hasNext: start + limit < cached.snaps.length,
                nextCursor: start + limit
            }
        };
     } catch (e) {
        throw (e);
     }
}

exports.getAnalytics = async (localityId, sensorType, startDate, endDate) => {
    if (!sensorType || !startDate || !endDate) throw { status: 422, message: 'Missing query parameters' };

    const cacheKey = `${localityId}:analytics_${sensorType}:${startDate}_${endDate}`;
    let cached = getCache(cacheKey);
    if (cached) return cached;

    try {
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

        const rangeDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
        
        let granularity;
        if (rangeDays <= 2) {
            granularity = 'hourly';
        } else if (rangeDays <= 90) {
            granularity = 'daily';
        } else {
            granularity = 'weekly'
        }

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
        if (!results || results.length === 0) throw { status: 404, message: 'No data available for this date range' };

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
    } catch (e) {
        throw (e);
    }
}

// export service rely on cached history and analytics snaps to hydrate export data
exports.exportData = async (localityId, category, sensorType, startDate, endDate, format = 'json', preview = false, previewLimit = 50) => {
    if (!sensorType || !startDate || !endDate || !category) throw { status: 422, message: 'Missing query parameters' };
    
    const cacheKey = `${localityId}:${category}_${sensorType}:${startDate}_${endDate}`;
    const cached = getCache(cacheKey);
    if (!cached || cached.length === 0) throw { status: 409, message: `No cached ${category} data available. Please load ${category} data first.` };

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
            data = await IoTModel.find(
                { _id: { $in: cached.snaps.map(d => d._id) } },
                { value: 1, recordedAt: 1 },
            ).lean();
            
            if (!data || data.length === 0) throw { status: 404, message: 'No available data for date range' };

            const order = new Map(cached.snaps.map((d, i) => [d._id.toString(), i]));
            data.sort((a, b) => order.get(a._id.toString()) - order.get(b._id.toString()));
            
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
        const valid = [];
        const invalid = [];
        
        const cleanedRows = parsedDataFile(data, user.localityId);

        cleanedRows.forEach((row, index) => {
            if (isValidHistoryRow(row)) {
                valid.push(row);
            } else {
                invalid.push({ data: row, index, reason: 'invalid timestamp or value' });
            }
        });
        if (valid.length === 0) throw { status: 400, message: 'No valid rows found' };

        const timestamps = valid.map(v => v.recordedAt);

        const existing = await IoTModel.find({
            localityId: user.localityId,
            sensorType,
            recordedAt: { $in: timestamps }
        }, { recordedAt: 1 }).lean();

        const existingTimestamps = new Set(
            existing.map(e => e.recordedAt.getTime())
        );

        const newRows = valid.filter(r => !existingTimestamps.has(r.recordedAt.getTime()));
        const duplicateCount = valid.length - newRows.length;

        setCache(cacheKey, newRows);

        return { 
            meta: {
                importId,
                sensorType
            }, 
            validRowsPreview: newRows.slice(0, 25),
            validRowsTotal: newRows.length,
            duplicates: duplicateCount,
            invalidRows: invalid.length,
            invalidRowsPreview: invalid.slice(0, 15)
        }
    } catch (e) {
        throw (e);
    }
}

exports.saveImport = async (importId, user, sensorType) => {
    if (!importId || !sensorType) throw { status: 422, message: 'Missing parameters' };

    const cacheKey = `${user._id}_${importId}:import_data:${sensorType}`;
    const cached = getCache(cacheKey);

    try {
        if (!cached || !cached.length) throw { status: 404, message: 'No import data found' };

        await IoTModel.insertMany(cached);
        clearCache(cacheKey);
    } catch (e) {
        throw (e);
    }
}