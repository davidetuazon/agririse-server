const mongoose = require('mongoose');
const IoTModel = require('./iot.model');
const mockSensorReadings = require('../../shared/services/mockSensorReadings');
const { periodToMilliseconds } = require('./iot.utils');

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
        const results = {};

        for (const type of sensorTypes) {
            const latest = await IoTModel.findOne({ localityId, sensorType: type }).sort({ recordedAt: -1 })

            if (latest) {
                results[type] = {
                    value: latest.value,
                    unit: latest.unit,
                    recordedAt: latest.recordedAt,
                };
            }
        }

        return results;
    } catch (e) {
        throw (e);
    }
}

// improve this query by:
// adding backward pagination
// can add page number by doing total docs / limit
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
            .find(query, { value: 1, unit: 1, recordedAt: 1, _id: 1 })
            .sort({ recordedAt:-1, _id: -1 })
            .limit(Number(limit) + 1);

        const hasNext = data.length > limit;
        if (hasNext) data.pop();
        
        let nextCursor = data.length
            ? {
                recordedAt: data[data.length - 1].recordedAt,
                _id: data[data.length - 1]._id
            }
            : null;

        const jsonString = JSON.stringify(nextCursor);
        const encodedCursor = Buffer.from(jsonString).toString('base64');
        nextCursor = encodedCursor;

        return {
            data,
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
exports.getAnalytics = async (localityId, sensorType, period, limit = 100, cursor = null) => {
    if (!sensorType || !period) throw { status: 422, message: 'Missing query parameters' };
    try {
        // today
        const toDate = new Date();
        toDate.setUTCHours(23, 59, 59, 999); // end of day UTC
        // period range
        const fromDate = new Date(toDate.getTime() - periodToMilliseconds(period));
        fromDate.setUTCHours(0, 0, 0, 0);  // start of day UTC

        const granularity = (period === '1day' || period === '7days') ? 'hourly' : 'daily';
        const dateFormat = granularity === 'hourly' ? '%Y-%m-%dT%H' : '%Y-%m-%d';

        const dataPipeline = [
            // filter by locality, sensor, and timestamp
            {
                $match: {
                    localityId,
                    sensorType,
                    recordedAt: { $gte: fromDate, $lte: toDate }
                }
            },
            // group by
            {
                $group: {
                    _id: { bucket: { $dateToString: { format: dateFormat, date: '$recordedAt' } } },
                    totalValue: { $sum: '$value' },
                    avgValue: { $avg: '$value' },
                    minValue: { $min: '$value' },
                    maxValue: { $max: '$value' },
                    stdDev: { $stdDevSamp: '$value' },
                    count: { $sum: 1 },
                }
            },
            // sort by ascending
            { $sort: { '_id.bucket': 1 } },
            {
                $project: {
                    bucket: '$_id.bucket',
                    totalValue: 1,
                    avgValue: 1,
                    minValue: 1,
                    maxValue: 1,
                    stdDev: 1,
                    count: 1,
                    _id: 0,
                    period,
                }
            }
        ];

        let results = await IoTModel.aggregate(dataPipeline).exec();

        if (cursor) {
            results = results.filter(r => r.bucket > cursor.bucket);
        }

        const hasNext = results.length > limit;
        if (hasNext) results = results.slice(0, limit);

        const nextCursorObj = results.length
            ? { bucket: results[results.length - 1].bucket }
            : null;

        const encodedCursor = nextCursorObj
            ? Buffer.from(JSON.stringify(nextCursorObj)).toString('base64')
            : null;

        return {
            data: results,
            pageInfo: {
                hasNext,
                nextCursor: encodedCursor,
            }
        };

    } catch (e) {
        throw (e);
    }
}