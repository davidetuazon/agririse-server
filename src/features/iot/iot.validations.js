const ALLOWED_SENSOR_TYPES = ['rainfall', 'humidity', 'temperature', 'damWaterLevel'];

const readings = {
    sensorType: {
        presence: { allowEmpty: false, message: 'is required.' },
        inclusion: {
            within: ALLOWED_SENSOR_TYPES,
            message: 'of: %{value} - has no readings or is not yet deployed.'
        }
    },
    startDate: {
        presence: { allowEmpty: false, message: 'is required.' },
    },
    endDate: {
        presence: { allowEmpty: false, message: 'is required.' },
    }
}

module.exports = {
    readings,
}