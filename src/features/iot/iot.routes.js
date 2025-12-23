const express = require('express');
const router = express.Router();

const iotController = require('./iot.controller');
const utils = require('../../shared/helpers/utils');

router.get('/latest', utils.authenticate, iotController.getLatestData);

router.get('/history', utils.authenticate, iotController.getHistoricalData);

router.get('/analytics', utils.authenticate, iotController.getAnalyticalData);

module.exports = router;