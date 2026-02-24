const express = require('express');
const router = express.Router();

const optimizationController = require('./optimization.controller');
const utils = require('../../shared/helpers/utils');

// statis routes
router.post('/ga', utils.authenticate, optimizationController.createOptimizationRun);

router.post('/callback', optimizationController.receiveOptimizationRunCallback);

router.get('/runs/solutions', utils.authenticate, optimizationController.getSelectedSolutionsHistory);

// dynamic routes
router.get('/runs/:runId', utils.authenticate, optimizationController.getOptimizationRunResults);

router.get('/runs/:runId/status', utils.authenticate, optimizationController.pollOptimizationRunStatus);

router.post('/runs/:runId/select', utils.authenticate, optimizationController.saveSelectedOptimizationSolution);

module.exports = router;