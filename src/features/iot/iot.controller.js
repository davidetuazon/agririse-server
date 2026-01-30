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
    const { sensorType, startDate, endDate, limit, cursor } = req.query;
    let limitNum = parseInt(limit) || 50;

    const issues = validate({ sensorType, startDate, endDate }, constraints.readings);
    if (issues) return res.status(422).json({ error: issues });

    try {
        const data = await IoTService.getHistory(localityId, sensorType, startDate, endDate, limitNum, parseInt(cursor));

        res.status(200).json(data);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.getAnalyticalData = async (req, res, next) => {
    const localityId = req.user.localityId;
    const { sensorType, startDate, endDate } = req.query;
    const issues = validate({ sensorType, startDate, endDate }, constraints.readings);
    if (issues) return res.status(422).json({ error: issues });

    try {
        const data = await IoTService.getAnalytics(localityId, sensorType, startDate, endDate);

        res.status(200).json(data);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.generateExportData = async (req, res, next) => {
    const localityId = req.user.localityId;
    const { category, sensorType, startDate, endDate, format } = {...req.body};
    const issues = validate({ category, sensorType, startDate, endDate, format }, constraints.exportData);
    if (issues) return res.status(422).json({ error: issues });

    try {
        const exportData = await IoTService.exportData(localityId, category, sensorType, startDate, endDate, format, true);

        res.status(200).json({
            fileName: `${category}_${sensorType}_${startDate}_${endDate}.${ format === 'csv' ? 'csv' : 'json' }`,
            data: exportData
        });
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.saveExportData = async (req, res, next) => {
    const localityId = req.user.localityId;
    const { category, sensorType, startDate, endDate, format } = {...req.body};
    const issues = validate({ sensorType, startDate, endDate, category, format }, constraints.exportData);
    if (issues) return res.status(422).json({ error: issues });

    try {
        const exportData = await IoTService.exportData(localityId, category, sensorType, startDate, endDate, format);

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename=${category}_${sensorType}_${startDate}_${endDate}.csv`
            );

            res.status(200).send(exportData);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename=${category}_${sensorType}_${startDate}_${endDate}.json`
            );
        }
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.processImportData = async (req, res, next) => {
    const { data, category, sensorType } = {...req.body};
    const issues = validate({ data, category, sensorType }, constraints.importData);
    if (issues) return res.status(422).json({ error: issues });

    try {
        const importPreview = await IoTService.importData(req.user, data, category, sensorType);

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