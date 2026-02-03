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

const HISTORY_HEADER_MAP = {
    recordedAt: ['recordedat', 'date', 'timestamp', 'time'],
    value: ['value', 'reading', 'level'],
}

const MAX_IMPORT_SIZE = 1000;
const MIN_DATA_POINTS = 3;

// change these if we have data available
const SENSOR_TREND_CONFIG = {
    damWaterLevel: {
        slopeThresholdPercent: 0.5,  // Dam levels change slowly, 0.5%/day is significant
        unit: '%',
        criticalChangeRate: 2.0  // >2%/day is critical
    },
    rainfall: {
        slopeThresholdPercent: 5.0,  // Rainfall is highly variable, need larger threshold
        unit: 'mm',
        criticalChangeRate: 20.0  // Heavy rain detection
    },
    humidity: {
        slopeThresholdPercent: 1.0,  // Moderate variability
        unit: '%',
        criticalChangeRate: 5.0
    },
    temperature: {
        slopeThresholdPercent: 2.0,  // Temperature fluctuates daily
        unit: '°C',
        criticalChangeRate: 8.0  // Sudden temp swings
    }
};

// change these if we have data available
const SENSOR_ANOMALY_CONFIG = {
    damWaterLevel: {
        absoluteMin: 0,
        absoluteMax: 100,
        criticalLow: 20,
        criticalHigh: 95,
        stdDevThreshold: 3,
        suddenChangePercent: 15  // 15% change between buckets is suspicious
        
        // absoluteMin: 0,
        // absoluteMax: 100,
        // criticalLow: 79.5,  // ← Lower this temporarily
        // criticalHigh: 80.5,  // ← Lower this temporarily
        // stdDevThreshold: 2,  // ← More sensitive
        // suddenChangePercent: 0.05  // ← Very sensitive (0.05%)
    },
    rainfall: {
        absoluteMin: 0,
        absoluteMax: 500,  // mm - extreme rainfall
        criticalLow: null,  // No critical low for rainfall
        criticalHigh: 100,  // Heavy rain
        stdDevThreshold: 3,
        suddenChangePercent: 200  // Rainfall can spike dramatically
    },
    humidity: {
        absoluteMin: 0,
        absoluteMax: 100,
        criticalLow: 10,
        criticalHigh: 95,
        stdDevThreshold: 3,
        suddenChangePercent: 30
    },
    temperature: {
        absoluteMin: -10,
        absoluteMax: 50,
        criticalLow: 0,
        criticalHigh: 45,
        stdDevThreshold: 3,
        suddenChangePercent: 40  // Temperature can change significantly
    }
};


module.exports = {
    SENSOR_META,
    DATA_TYPE,
    HISTORY_HEADER_MAP,
    MIN_DATA_POINTS,
    MAX_IMPORT_SIZE,
    SENSOR_TREND_CONFIG,
    SENSOR_ANOMALY_CONFIG,
}