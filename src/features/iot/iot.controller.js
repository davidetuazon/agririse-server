const IoTService = require('./iot.service');
const validate = require('validate.js');

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
    const { sensorType, period, limit, cursor } = req.query;

    const issues = validate({ sensorType, period, limit, cursor }, {
        sensorType: {
            presence: true,
        },
        period: {
            presence: true,
        },
    });
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
    const { sensorType, period } = req.query;

    const issues = validate({ sensorType, period }, {
        sensorType: {
            presence: true,
        },
        period: {
            presence: true,
        },
    });
    if (issues) return res.status(422).json({ error: issues });

    try {
        const data = await IoTService.getAnalytics(localityId, sensorType, period);

        res.status(200).json({ data });
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}