const express = require('express');
const router = express.Router();

const iotController = require('./iot.controller');
const utils = require('../../shared/helpers/utils');

router.get('/latest', utils.authenticate, iotController.getLatestData);

router.get('/history', utils.authenticate, iotController.getHistoricalData);

router.get('/analytics', utils.authenticate, iotController.getAnalyticalData);

// this route expects a url like this: /export?type=history&sensorType=damWaterLevel&startDate=2025-12-28&endDate=2026-01-27
router.get('/export', utils.authenticate, iotController.generateExportDataCSV);

module.exports = router;