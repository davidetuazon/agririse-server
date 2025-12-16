const IoTModel = require('./iot.model');
const mockSensorReadings = require('../../shared/services/mockSensorReadings');

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
            const latest = await IoTModel.findOne({ localityId, sensorType: type }).sort({ createdAt: -1 })

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