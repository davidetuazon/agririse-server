const SENSOR_META = {
    damWaterLevel: { unit: '%', label: 'Dam Water Level' },
    humidity: { unit: '%', label: 'Humidity' },
    rainfall: { unit: 'mm', label: 'Effective Rainfall' },
    temperature: { unit: '°C', label: 'Temperature' },
}

const DATA_TYPE = {
    analytics: ['timestamp', 'total', 'avg', 'min', 'max', 'stdDev', 'count'],
    history: ['recordedAt', 'value', '_id']
}

const generateCSV = (data, columns) => {
    if (!Array.isArray(data) || data.length === 0) return '';

    const keys = columns || Object.keys(data[0]);

    const header = keys.join(',');
    const rows = data.map(item => {
        return keys
            .map(k => {
                let value = item[k];

                if (value === null || value === undefined) return '';

                if (value instanceof Date) {
                    value = value.toISOString();
                }

                if (typeof value === 'string') {
                    value = value.replace(/"/g, '""');
                    
                    if (value.includes(',') || value.includes('/n')) value = `'${value}`
                }
                return value;
            })
            .join(',')
    });

    return [header, ...rows].join('\n');
}

module.exports = {
    SENSOR_META,
    DATA_TYPE,
    generateCSV
}