const mongoose = require('mongoose');
const IoTModel = require('./iot.model');
require('../locality/locality.model');
const mockSensorReadings = require('../../shared/services/mockSensorReadings');
const { SENSOR_META, DATA_TYPE, generateCSV } = require('./iot.utils');
const { setCache, getCache, clearCache, clearAllCache } = require('../../cache/redis-cache');

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

    const cacheKey = `${user._id}:latest-${user.localityId}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    try {
        const queries = sensorTypes.map(type =>
            IoTModel.findOne({ localityId: user.localityId, sensorType: type })
            .sort({ recordedAt: -1 })
            .populate({ path: 'localityId', select: 'city province region' })
        )
        const docs = await Promise.all(queries);
        
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
        setCache(cacheKey, data);

        return data;
    } catch (e) {
        throw (e);
    }
}

// improve this query by:
// adding backward pagination
// can add page number by doing total docs / limit

// Pagination scheme:
// - Sorted by recordedAt DESC (newest -> oldest)
exports.getHistory = async (localityId, sensorType, startDate, endDate, limit, cursor = null) => {
    if (!sensorType || !startDate || !endDate) throw { status: 422, message: 'Missing query parameters' };
    
    const cacheKey = `${localityId}:history-${sensorType}:${startDate}-${endDate}`;
    const cached = getCache(cacheKey);
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

        const query = {
            localityId,
            sensorType,
            recordedAt: { $gte: fromDate, $lte: toDate }
        };

        if (cursor) {
            const parsedCursor = {
                recordedAt: new Date(cursor.recordedAt),
                _id: new mongoose.Types.ObjectId(cursor._id)
            };

            query.$or = [
                { recordedAt: { $lt: parsedCursor.recordedAt } },
                {
                    recordedAt: parsedCursor.recordedAt,
                    _id: { $lt: parsedCursor._id }
                }
            ]
        };

        const data = await IoTModel
            .find(query, { value: 1, recordedAt: 1, _id: 1 })
            .sort({ recordedAt:-1, _id: -1 })
            .limit(Number(limit) + 1);

        const hasNext = data.length > limit;
        if (hasNext) data.pop();

        let nextCursor = null;
        if (data.length) {
            nextCursor = Buffer.from(JSON.stringify({
                recordedAt: data[data.length - 1].recordedAt,
                _id: data[data.length - 1]._id
            })).toString('base64');
        }

        const results = {
            data,
            meta: {
                dateRange: { startDate: fromDate, endDate: toDate },
                unit: SENSOR_META[sensorType].unit,
                sensorType: SENSOR_META[sensorType].label,
            },
            pageInfo: {
                hasNext,
                nextCursor,
            }
        };
        setCache(cacheKey, results);

        return results;
    } catch (e) {
        throw (e);
    }
}

// improve this query by:
// adding backward pagination
// can add page number by doing total docs / limit

// Pagination scheme:
// - Sorted by recordedAt ASC (oldest -> newest)
exports.getAnalytics = async (localityId, sensorType, startDate, endDate, limit = 100, cursor = null) => {
    if (!sensorType || !startDate || !endDate) throw { status: 422, message: 'Missing query parameters' };
    
    const cacheKey = `${localityId}:analytics-${sensorType}:${startDate}-${endDate}`;
    const cached = getCache(cacheKey);
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

        const dataPipeline = [];

        dataPipeline.push({
            $match: {
                localityId,
                sensorType,
                recordedAt: { $gte: fromDate, $lte: toDate }
            }
        });

        if(cursor) {
            dataPipeline.push({
                $match: {
                    recordedAt: { $gt: cursor}
                }
            });
        };

        dataPipeline.push(
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
            { $limit: limit + 1 },
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
        );

        let results = await IoTModel.aggregate(dataPipeline).exec();

        const hasNext = results.length > limit;
        if (hasNext) results = results.slice(0, limit);

        const nextCursorObj = results.length
            ? { bucket: results[results.length - 1].bucket }
            : null;

        const encodedCursor = nextCursorObj
            ? Buffer.from(JSON.stringify(nextCursorObj)).toString('base64')
            : null;

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
            },
            pageInfo: {
                hasNext,
                nextCursor: encodedCursor,
            }
        };
        setCache(cacheKey, aggregatedResults);

        return aggregatedResults;
    } catch (e) {
        throw (e);
    }
}

exports.exportDataCSV = async (localityId, sensorType, startDate, endDate, type) => {
    if (!sensorType || !startDate || !endDate || !type) throw { status: 422, message: 'Missing query parameters' };
    
    const cacheKey = `${localityId}:${type}-${sensorType}:${startDate}-${endDate}`;
    const cached = getCache(cacheKey);

    if (!cached) throw { status: 409, message: `No cached ${type} data available. Please load ${type} data first.` };

    try {
        const dataArray = type === 'analytics' ? cached.series : cached.data;
        if (!dataArray || dataArray.length === 0) {
            return DATA_TYPE[type].join(',');
        }

        return generateCSV(dataArray, DATA_TYPE[type]);
    } catch (e) {
        throw (e);
    }
}