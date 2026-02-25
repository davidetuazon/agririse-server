const express = require('express');
const router = express.Router();

const forecastController = require('./forecast.controller');
const utils = require('../../shared/helpers/utils');

router.post('/trigger/manual', utils.authenticate, forecastController.triggerForecastManual);

router.post('/callback', forecastController.receiveForecastCallback);

router.get('/status', utils.authenticate, forecastController.getForecastStatus);

router.get('/data', utils.authenticate, forecastController.getForecastData);

module.exports = router;