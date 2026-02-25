const ForecastService = require('./forecast.service');
const validate = require('validate.js');

exports.triggerForecastManual = async (req, res, next) => {
    const localityId = req.user.localityId;

    try {
        const triggerStatus = await ForecastService.triggerForecast(localityId);

        return res.status(200).json(triggerStatus);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.receiveForecastCallback = async (req, res, next) => {
    const result = {...req.body};
    const issues = validate(result, {
        localityId: { presence: true },
        status: { presence: true },
    });
    if (issues) return res.status(422).json({ error: issues });

    try {
        const status = await ForecastService.receiveAndProcessForecastCallback(result);

        return res.status(201).json(status);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.getForecastStatus = async (req, res, next) => {
    const localityId = req.user.localityId;

    try {
        const status = await ForecastService.getStatus(localityId);

        return res.status(200).json(status);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.getForecastData = async (req, res, next) => {
    const localityId = req.user.localityId;

    try {
        const forecasts = await ForecastService.getData(localityId);

        return res.status(200).json(forecasts);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}