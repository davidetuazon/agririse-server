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

exports.insertReadings = async (req, res, next) => {
    const data = {...req.body};
    const localityId = req.user.localityId; // use user for now but attach locality id on request
    const readings = Array.isArray(data) ? data : [data];

    const validationErrors = [];
    readings.forEach((reading) => {
        const issues = validate(reading, constraints.createReadings);
        if (issues) validationErrors.push(issues);
    });
    if (validationErrors.length > 0) return res.status(422).json({ error: validationErrors });

    try {
        const result = await IoTService.insertReadings(localityId, readings);
        const allAlerts = result.results.filter(r => r.alerts).flatMap(r => r.alerts);
        
        const data = {
            inserted: result.inserted,
            failed: result.failed,
            readings: result.results.map(r => r.reading),
            alerts: allAlerts.length > 0 ? allAlerts : null,
            errors: result.errors,
        }

        res.status(200).json(data)
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
            fileName: `${exportData.fileName}.${ format === 'csv' ? 'csv' : 'json' }`,
            data: exportData.data,
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
                `attachment; filename=${exportData.fileName}.csv`
            );

            res.status(200).send(exportData.data);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename=${exportData.fileName}.json`
            );
        }
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.processImportData = async (req, res, next) => {
    const { data, sensorType } = {...req.body};
    
    let validationSchema;
    if (typeof data === 'string') {
        validationSchema = constraints.importDataFile;
    } else if (Array.isArray(data)) {
        validationSchema = constraints.importDataJson;
    } else {
        return res.status(400).json({ message: 'Must be either a file path or an array of records' });
    }

    const issues = validate({ data, sensorType }, validationSchema);
    if (issues) return res.status(422).json({ error: issues });

    try {
        const importPreview = await IoTService.importData(req.user, data, sensorType);

        res.status(200).json(importPreview);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.saveImportData = async (req, res, next) => {
    const { importId, sensorType } = {...req.body};
    const issues = validate({ importId, sensorType }, constraints.saveData);
    if (issues) return res.status(422).json({ error: issues });

    try {
        const data = await IoTService.saveImport(importId, req.user, sensorType);

        res.status(200).json(data);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}