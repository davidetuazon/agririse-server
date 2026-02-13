const IoTModel = require('../iot.model');
const AlertModel = require('../iot.alert.model');
const { SENSOR_ANOMALY_CONFIG } = require('./constants');

const validateData = (value, sensorType) => {
    const config = SENSOR_ANOMALY_CONFIG[sensorType];
    if (!config) return { valid: false, reason: 'Invalid sensor type' };

    if (value < config.absoluteMin) {
        return {
            valid: false,
            reason: `Value ${value} below minimum ${config.absoluteMin}`,
        }
    }

    if (value > config.absoluteMax) {
        return {
            valid: false,
            reason: `Value ${value} above maximum ${config.absoluteMax}`,
        }
    }

    return { valid: true };
}

const checkCriticalThreshold = async (reading) => {
    const config = SENSOR_ANOMALY_CONFIG[reading.sensorType];
    if (!config) return [];

    const alerts = [];

    if (reading.value >= config.criticalHigh) {
        const alert = await AlertModel.create({
            localityId: reading.localityId,
            sensorType: reading.sensorType,
            severity: 'critical',
            type: 'threshold_exceeded',
            value: reading.value,
            threshold: config.criticalHigh,
            message: `${reading.sensorType} critically high: ${reading.value}${reading.unit}`,
            readingId: reading._id,
        });
        alerts.push(alert);
    }

    if (config.criticalLow !== null && reading.value <= config.criticalLow) {
        const alert = await AlertModel.create({
            localityId: reading.localityId,
            sensorType: reading.sensorType,
            severity: 'critical',
            type: 'threshold_exceeded',
            value: reading.value,
            threshold: config.criticalLow,
            message: `${reading.sensorType} critically low: ${reading.value}${reading.unit}`,
            readingId: reading._id,
        });
        alerts.push(alert);
    }

    return alerts;
}

const checkSuddenChange = async (reading) => {
    const config = SENSOR_ANOMALY_CONFIG[reading.sensorType];
    if (!config) return null;
    
    const previousReading = await IoTModel.findOne({
        localityId: reading.localityId,
        sensorType: reading.sensorType,
        _id: { $ne: reading._id },
        recordedAt: { $lt: reading.recordedAt }
    }).sort({ recordedAt: -1 });

    if (!previousReading) return null;

    const delta = Math.abs(reading.value - previousReading.value);
    const percentChange = previousReading.value !== 0
        ? (delta / previousReading.value ) * 100
        : 0;
    
    if (percentChange > config.suddenChangePercent) {
        return await AlertModel.create({
            localityId: reading.localityId,
            sensorType: reading.sensorType,
            severity: 'warning',
            type: 'sudden_change',
            value: reading.value,
            previousValue: previousReading.value,
            percentChange,
            message: `Sudden ${percentChange.toFixed(1)}% change in ${reading.sensorType}`,
            readingId: reading._id,
        })
    }

    return null;
}

module.exports = {
    validateData,
    checkCriticalThreshold,
    checkSuddenChange,
}