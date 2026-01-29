const express = require('express');
const router = express.Router();

const iotController = require('./iot.controller');
const utils = require('../../shared/helpers/utils');

router.get('/latest', utils.authenticate, iotController.getLatestData);

router.get('/history', utils.authenticate, iotController.getHistoricalData);

router.get('/analytics', utils.authenticate, iotController.getAnalyticalData);

// this route expects a url like this: /export?type=history&sensorType=damWaterLevel&startDate=2025-12-28&endDate=2026-01-27
router.get('/data/export', utils.authenticate, iotController.generateExportData);

router.post('/data/import', utils.authenticate, iotController.processImportData);

router.post('/data/import/save', utils.authenticate, iotController.saveImportData);

module.exports = router;