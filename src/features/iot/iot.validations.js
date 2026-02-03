const ALLOWED_SENSOR_TYPES = ['rainfall', 'humidity', 'temperature', 'damWaterLevel'];
const ALLOWED_TYPES = ['analytics', 'history'];

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
};

const exportData = {
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
    },
    category: {
        presence: { allowEmpty: false, message: 'is required.' },
        inclusion: {
            within: ALLOWED_TYPES,
            message: 'of: %{value} - is not a valid data type.'
        }
    },
    format: {
        presence: { allowEmpty: false, message: 'is required.' },
        inclusion: {
            within: ['csv', 'json'],
            message: 'of "%{value}" is an invalid export format.'
        }
    }
}

const importData = {
    data: {
        presence: { allowEmpty: false, message: 'is required.' },
    },
    sensorType: {
        presence: { allowEmpty: false, message: 'is required.' },
        inclusion: {
            within: ALLOWED_SENSOR_TYPES,
            message: 'of: %{value} - has no readings or is not yet deployed.'
        }
    },
}

module.exports = {
    readings,
    exportData,
    importData,
}