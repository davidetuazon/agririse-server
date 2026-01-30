const mongoose = require('mongoose');
const IoTModel = require('./iot.model');
require('../locality/locality.model');
const mockSensorReadings = require('../../shared/services/mockSensorReadings');
const { SENSOR_META, DATA_TYPE, generateCSV, parsedDataFile, isValidHistoryRow, isValidAnalyticsRow } = require('./iot.utils');
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
            IoTModel.findOne({ localityId: user.localityId, sensorType: type })
            .sort({ recordedAt: -1 })
            .populate({ path: 'localityId', select: 'city province region' })
        )
        const docs = await Promise.all(queries);
        if (!docs) throw { status: 404, message: 'Displayed data is up to date' };
        
        const results = {};
        let locality = null;

        docs.forEach(doc => {
            if (!doc) return;

            if (!locality && doc.localityId) {
                locality = doc.localityId;
            }

            results[doc.sensorType] = {
                value: doc.value,
                unit: doc.unit,
                recordedAt: doc.recordedAt,
                sensorType: SENSOR_META[doc.sensorType].label,
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
                    count: 1,
                    _id: 0,
                }
            }
        ];

        const results = await IoTModel.aggregate(dataPipeline).exec();

        const unit = SENSOR_META[sensorType].unit;
        const aggregatedResults = {
            series: results.map(r => ({
                timestamp: r.bucket,
                total: r.total,
                avg: r.avg,
                min: r.min,
                max: r.max,
                stdDev: r.stdDev,
                count: r.count,
            })),
            meta: {
                dateRange: { startDate: fromDate, endDate: toDate },
                granularity,
                unit,
                sensorType: SENSOR_META[sensorType].label,
                metric: 'average',
            }
        };
        setCache(cacheKey, aggregatedResults);

        return aggregatedResults;
    } catch (e) {
        throw (e);
    }
}

// export service rely on cached history and analytics snaps to hydrate export data
exports.exportData = async (localityId, category, sensorType, startDate, endDate, format, preview = false, previewLimit = 50) => {
    if (!sensorType || !startDate || !endDate || !category) throw { status: 422, message: 'Missing query parameters' };
    
    const cacheKey = `${localityId}:${category}_${sensorType}:${startDate}_${endDate}`;
    const cached = getCache(cacheKey);
    if (!cached) throw { status: 409, message: `No cached ${category} data available. Please load ${category} data first.` };

    try {
        let data;

        // for analytics data
        if (category === 'analytics') {
            data = cached.series;

            if (preview) data = data.slice(0, previewLimit);
        // for history data
        } else {
            data = await IoTModel.find(
                { _id: { $in: cached.snaps.map(d => d._id) } },
                { value: 1, recordedAt: 1 },
            ).lean();

            const order = new Map(cached.snaps.map((d, i) => [d._id.toString(), i]));
            data.sort((a, b) => order.get(a._id.toString()) - order.get(b._id.toString()));

            if (preview) data = data.slice(0, previewLimit);
        }

        // return headers only when no data
        if (!data || data.length === 0) return DATA_TYPE[category].join(',');

        const csv = generateCSV(data, DATA_TYPE[category]);

        const formattedData = format === 'csv' 
            ? csv.replace(/\n/g, '\r\n')
            : data;
        if (!formattedData || formattedData.length === 0) throw { status: 400, message: 'No valid data found' };

        return formattedData;
    } catch (e) {
        throw (e);
    }
}

exports.importData = async (user, data, category, sensorType) => {
    if (!data || !category || !sensorType) throw { status: 422, message: 'Missing parameters' };
    
    const importId = crypto.randomUUID();
    const cacheKey = `${user._id}_${importId}:${category}_import_data:${sensorType}`;

    try {
        const cleanedRows = parsedDataFile(data, category);

        const transformedData = category === 'history'
            ? cleanedRows.filter(isValidHistoryRow)
            : cleanedRows.filter(isValidAnalyticsRow);

        if (!transformedData.length) throw { status: 400, message: 'No valid rows found' };

        setCache(cacheKey, transformedData);
        const preview = transformedData.slice(0, 20);

        return { 
            meta: {
                importId,
                category,
                sensorType
            }, 
            preview,
            total: transformedData.length
        }
    } catch (e) {
        throw (e);
    }
}

exports.saveImport = async (importId, user, type, sensorType) => {
    if (!importId || !type || !sensorType) throw { status: 422, message: 'Missing parameters' };

    const cacheKey = `${user._id}_${importId}:${type}_import_data:${sensorType}`;
    const cached = getCache(cacheKey);

    try {
        if (!cached || !cached.length) throw { status: 404, message: 'No import data found' };

        await IoTModel.insertMany(cached);
        clearCache(cacheKey);
    } catch (e) {
        throw (e);
    }
}