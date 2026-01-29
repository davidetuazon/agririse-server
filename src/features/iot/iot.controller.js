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
    try {
        const data = await IoTService.getLatestReadings(req.user);

        res.status(200).json(data);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.getHistoricalData = async (req, res, next) => {
    const localityId = req.user.localityId;
    const { sensorType, startDate, endDate, limit } = req.query;
    let limitNum = parseInt(limit) || 50;
    let cursor = req.query.cursor;

    if (cursor) {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        cursor = JSON.parse(decoded);
    }

    const issues = validate({ sensorType, startDate, endDate }, constraints.readings);
    if (issues) return res.status(422).json({ error: issues });

    try {
        const data = await IoTService.getHistory(localityId, sensorType, startDate, endDate, limitNum, cursor);

        res.status(200).json(data);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.getAnalyticalData = async (req, res, next) => {
    const localityId = req.user.localityId;
    const { sensorType, startDate, endDate, limit } = req.query;
    let limitNum = parseInt(limit) || 50;
    let cursor = req.query.cursor;

    if (cursor) {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        cursor = JSON.parse(decoded);
    }

    const issues = validate({ sensorType, startDate, endDate }, constraints.readings);
    if (issues) return res.status(422).json({ error: issues });

    try {
        const data = await IoTService.getAnalytics(localityId, sensorType, startDate, endDate, limitNum, cursor);

        res.status(200).json(data);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.generateExportData = async (req, res, next) => {
    const localityId = req.user.localityId;
    const { type, sensorType, startDate, endDate, format, limit } = req.query;
    let limitNum = parseInt(limit) || 50;
    let cursor = req.query.cursor;

    if (cursor) {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        cursor = JSON.parse(decoded);
    }

    const issues = validate({ sensorType, startDate, endDate, type, format }, constraints.exportData);
    if (issues) return res.status(422).json({ error: issues });

    try {
        const csv = await IoTService.exportData(localityId, sensorType, startDate, endDate, type, limitNum, cursor, format);
        const csvFormatted = csv.replace(/\n/g, '\r\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=${type}_${sensorType}_${startDate}_${endDate}.csv`
        )

        // let frontend handle the download
        // this allows user to review the data being exported before downloading
        res.status(200).json({
            filename: `${type}_${sensorType}_${startDate}_${endDate}.csv`,
            csv: csvFormatted,
        });
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.processImportData = async (req, res, next) => {
    const { data, type, sensorType } = {...req.body};
    const issues = validate({ data, type, sensorType }, constraints.importData);
    if (issues) return res.status(422).json({ error: issues });

    try {
        const importPreview = await IoTService.importData(req.user, data, type, sensorType);

        res.status(200).json(importPreview);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.saveImportData = async (req, res, next) => {
    const { importId, type, sensorType } = {...req.body};
    const issues = validate({ importId, type, sensorType }, {
        importId: { presence: true },
        type: { presence: true },
        sensorType: { presence: true },
    });
    if (issues) return res.status(422).json({ error: issues });

    try {
        const data = await IoTService.saveImport(importId, req.user, type, sensorType);

        res.status(200).json(data);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}