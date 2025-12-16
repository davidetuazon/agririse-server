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
                    timestamp: latest.recordedAt,
                };
            }
        }

        return results;
    } catch (e) {
        throw (e);
    }
}

// can improve query by 
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
            query.recordedAt.$gt = new Date(cursor)
        };

        const data = await IoTModel
            .find(query, { value: 1, unit: 1, recordedAt: 1, _id: 0 })
            .sort({ recordedAt: -1 })
            .limit((Number(limit)));

        return {
            data,
            nextCursor: data.length
                ? data[data.length - 1].recordedAt
                : null,
        };
    } catch (e) {
        throw (e);
    }
}

exports.getAnalytics = async (localityId, sensorType, period) => {
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
            // 1. filter by locality, sensor, and timestamp
            {
                $match: {
                    localityId,
                    sensorType,
                    recordedAt: { $gte: fromDate, $lte: toDate }
                }
            },
            // 2. group by
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
            // 3. sort by
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
                    period
                }
            }
        ];

        const results = await IoTModel.aggregate(dataPipeline).exec();
        return results;
    } catch (e) {
        throw (e);
    }
}