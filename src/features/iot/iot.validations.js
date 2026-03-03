const ALLOWED_SENSOR_TYPES = ['rainfall', 'humidity', 'temperature', 'damWaterLevel'];
const ALLOWED_TYPES = ['analytics', 'history'];

const createReadings = {
    sensorType: {
        presence: { allowEmpty: false, message: 'is required.' },
    },
    value: {
        presence: { allowEmpty: false, message: 'is required.' },
        numericality: { 
            onlyInteger: false, 
            strict: true,
            message: 'must be a number.' 
        },
    },
    recordedAt: {
        presence: { allowEmpty: false, message: 'is required.' },
    }
};

const readings = {
    sensorType: {
        presence: { allowEmpty: false, message: 'is required.' },
        inclusion: {
            within: ALLOWED_SENSOR_TYPES,
            message: 'of: %{value} - has no readings or is not yet deployed.'
        }
    },
    value: {
        numericality: { onlyInteger: false, strict: true, message: 'must be a number.' }, 
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

const importDataFile = {
    data: {
        presence: { allowEmpty: false },
        format: {
            pattern: /\.(csv|json)$/i,
            message: 'must be a .csv or .json file',
        }
    },
    sensorType: {
        presence: { allowEmpty: false, message: 'is required.' },
        inclusion: {
            within: ALLOWED_SENSOR_TYPES,
            message: 'of: %{value} - has no readings or is not yet deployed.'
        }
    },
}

const importDataJson = {
    data: {
        presence: { allowEmpty: false },
        type: 'array',  // ← Expects array
        length: { minimum: 1, message: 'must contain at least one record' }
    },
    sensorType: {
        presence: { allowEmpty: false, message: 'is required.' },
        inclusion: {
            within: ALLOWED_SENSOR_TYPES,
            message: 'of: %{value} - has no readings or is not yet deployed.'
        }
    },
};

const saveData = {
    importId: {
        presence: { allowEmpty: false, message: 'is required.' },
    },
    sensorType: {
        presence: { allowEmpty: false, message: 'is required.' },
        inclusion: {
            within: ALLOWED_SENSOR_TYPES,
            message: 'of: %{value} - has no readings or is not yet deployed.'
        }
    }
}

module.exports = {
    createReadings,
    readings,
    exportData,
    importDataFile,
    importDataJson,
    saveData,
}