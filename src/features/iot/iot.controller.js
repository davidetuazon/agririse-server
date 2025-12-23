const IoTService = require('./iot.service');
const validate = require('validate.js');
const constraints = require('./iot.validations');

// for mocking real iot sensors
exports.generateMockData = async (req, res, next) => {
    const localityId = req.user.localityId;

    try {
        const data = await IoTService.generateMockReadings(localityId);

        res.status(201).json({ message: 'Mock data generated', data });
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.getLatestData = async (req, res, next) => {
    const localityId = req.user.localityId;

    try {
        const data = await IoTService.getLatestReadings(localityId);

        res.status(200).json({ data });
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.getHistoricalData = async (req, res, next) => {
    const localityId = req.user.localityId;
    const { sensorType, period, limit } = req.query;
    let cursor = req.query.cursor;

    if (cursor) {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        cursor = JSON.parse(decoded);
    }

    const issues = validate({ sensorType, period }, constraints.readings);
    if (issues) return res.status(422).json({ error: issues });

    try {
        const data = await IoTService.getHistory(localityId, sensorType, period, limit, cursor);

        res.status(200).json(data);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.getAnalyticalData = async (req, res, next) => {
    const localityId = req.user.localityId;
    const { sensorType, period, limit } = req.query;
    let cursor = req.query.cursor;

    if (cursor) {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        cursor = JSON.parse(decoded);
    }

    const issues = validate({ sensorType, period }, constraints.readings);
    if (issues) return res.status(422).json({ error: issues });

    try {
        const data = await IoTService.getAnalytics(localityId, sensorType, period, limit, cursor);

        res.status(200).json({ data });
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}