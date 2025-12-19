const ALLOWED_SENSOR_TYPES = ['rainfall', 'humidity', 'temperature', 'damWaterLevel'];
const ALLOWED_PERIODS = ['1day', '7days', '2weeks', '1month', '3months', '6months', '1year'];

const readings = {
    sensorType: {
        presence: { allowEmpty: false, message: 'is required.' },
        inclusion: {
            within: ALLOWED_SENSOR_TYPES,
            message: 'of: %{value} - has no readings or is not yet deployed.'
        }
    },
    period: {
        presence: { allowEmpty: false, message: 'is required.' },
        inclusion: {
            within: ALLOWED_PERIODS,
            message: 'must be one of: ' + ALLOWED_PERIODS.join(', ')
        }
    }
}

module.exports = {
    readings,
}