const express = require('express');
const router = express.Router();

const optimizationController = require('./optimization.controller');
const utils = require('../../shared/helpers/utils');

router.post('/ga', utils.authenticate, optimizationController.createOptimizationRun);

router.post('/callback', optimizationController.receiveOptimizationRunCallback);

module.exports = router;