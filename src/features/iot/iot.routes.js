const express = require('express');
const router = express.Router();

const iotController = require('./iot.controller');
const utils = require('../../shared/helpers/utils');

router.get('/iot/latest', utils.authenticate, iotController.getLatestData);

router.get('/iot/history', utils.authenticate, iotController.getHistoricalData);

router.get('/iot/analytics', utils.authenticate, iotController.getAnalyticalData);

module.exports = router;