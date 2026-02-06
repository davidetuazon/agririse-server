const express = require('express');
const router = express.Router();

const iotController = require('./iot.controller');
const utils = require('../../shared/helpers/utils');

// assume data streams come as post call
// use user for locality id for now
router.post('/readings', utils.authenticate, iotController.insertReadings);

router.get('/latest', utils.authenticate, iotController.getLatestData);

router.get('/history', utils.authenticate, iotController.getHistoricalData);

router.get('/analytics', utils.authenticate, iotController.getAnalyticalData);

// use this route for generating and previewing data to export
router.post('/data/export', utils.authenticate, iotController.generateExportData);

// use this route for downloading exported data
router.post('/data/export/save', utils.authenticate, iotController.saveExportData);

router.post('/data/import', utils.authenticate, iotController.processImportData);

router.post('/data/import/save', utils.authenticate, iotController.saveImportData);

module.exports = router;