const mongoose = require('mongoose');
const IoTModel = require('./iot.model');
require('../locality/locality.model');
const mockSensorReadings = require('../../shared/services/mockSensorReadings');
const { periodToMilliseconds, SENSOR_META } = require('./iot.utils');

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


exports.getLatestReadings = async (localityId) => {
    const sensorTypes = [
        'rainfall',
        'humidity',
        'temperature',
        'damWaterLevel'
    ];

    try {
        const queries = sensorTypes.map(type =>
            IoTModel.findOne({ localityId, sensorType: type })
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
            };
        });

        return {
            locality,
            readings: results,
        }
    } catch (e) {
        throw (e);
    }
}

// improve this query by:
// adding backward pagination
// can add page number by doing total docs / limit

// Pagination scheme:
// - Sorted by recordedAt DESC (newest -> oldest)
exports.getHistory = async (localityId, sensorType, period, limit = 100, cursor = null) => {
    if (!sensorType || !period) throw { status: 422, message: 'Missing query parameters' };
    try {
        // today
        const toDate = new Date();
        toDate.setUTCHours(23, 59, 59, 999); // end of day UTC
        // period range
        const fromDate = new Date(toDate.getTime() - periodToMilliseconds(period));
        fromDate.setUTCHours(0, 0, 0, 0);  // start of day UTC

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

        const unit = SENSOR_META[sensorType].unit;

        return {
            data,
            meta: {
                period,
                unit,
                sensorType,
            },
            pageInfo: {
                hasNext,
                nextCursor,
            }
        };
    } catch (e) {
        throw (e);
    }
}

// improve this query by:
// adding backward pagination
// can add page number by doing total docs / limit

// Pagination scheme:
// - Sorted by recordedAt ASC (oldest -> newest)
exports.getAnalytics = async (localityId, sensorType, period, limit = 100, cursor = null) => {
    if (!sensorType || !period) throw { status: 422, message: 'Missing query parameters' };
    try {
        // today
        const toDate = new Date();
        toDate.setUTCHours(23, 59, 59, 999); // end of day UTC
        // period range
        const fromDate = new Date(toDate.getTime() - periodToMilliseconds(period));
        fromDate.setUTCHours(0, 0, 0, 0);  // start of day UTC

        const granularity = (period === '1day' || period === '7days') ? 'Hourly' : 'Daily';

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
                                unit: granularity === 'hourly' ? 'hour' : 'day',
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
                    period,
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

        return {
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
                period,
                granularity,
                unit,
                sensorType,
                metric: 'Average',
            },
            pageInfo: {
                hasNext,
                nextCursor: encodedCursor,
            }
        };

    } catch (e) {
        throw (e);
    }
}