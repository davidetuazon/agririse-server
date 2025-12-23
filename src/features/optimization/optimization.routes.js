const express = require('express');
const router = express.Router();

const optimizationController = require('./optimization.controller');
const utils = require('../../shared/helpers/utils');

router.post('/ga', utils.authenticate, optimizationController.runOptimizationService);

module.exports = router;