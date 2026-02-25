require('dotenv').config({ quiet: true });
const OptimizationService = require('./optimization.service');
const constraints = require('./optimization.validations');
const validate = require('validate.js');

exports.createOptimizationRun = async (req, res, next) => {
    const params = {...req.body};
    const issues = validate(params, constraints.optimizationInput);
    if (issues) return res.status(422).json({ error: issues });

    try {
        const optimizationInput = await OptimizationService.prepareRunInput(req.user, params);
        const optimizationDoc = await OptimizationService.initiateRun(req.user, optimizationInput);
       
        return res.status(201).json({ optimizationRun: optimizationDoc });
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.receiveOptimizationRunCallback = async (req, res, next) => {
    const result = {...req.body};
    const issues = validate(result, { 
        runId: { presence: true },
        status: { presence: true },
    });
    if (issues) return res.status(422).json({ error: issues });

    try {
        const status = await OptimizationService.receiveAndProcessRunCallback(result);

        return res.status(201).json(status);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.pollOptimizationRunStatus = async (req, res, next) => {
    const { runId } = req.params;
    const issues = validate({ runId },{ runId: { presence: true } });
    if (issues) return res.status(422).json({ error: issues });

    try {
        const pollStatus = await OptimizationService.pollRunStatus(req.user._id, runId );

        return res.status(200).json(pollStatus);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.getOptimizationRunResults = async (req, res, next) => {
    const { runId } = req.params;
    const issues = validate({ runId },{ runId: { presence: true } });
    if (issues) return res.status(422).json({ error: issues });

    try {
        const results = await OptimizationService.getRunResults(req.user.localityId, runId);

        return res.status(200).json(results);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.saveSelectedOptimizationSolution = async (req, res, next) => {
    const { runId } = req.params;
    const { solutionId } = req.body;
    const issues = validate({ runId, solutionId }, { 
        runId: { presence: true },
        solutionId: { presence: true },
    });
    if (issues) return res.status(422).json({ error: issues });

    try {
        const status = await OptimizationService.saveSelectedSolution(req.user, runId, solutionId);

        return res.status(201).json(status);
    } catch (e) {
        if (e.code === 11000 ) return res.status(409).json({ error: 'A solution has already been selected for this run' });
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}

exports.getSelectedSolutionsHistory = async (req, res, next) => {
    const { year, scenario, cropVariant } = req.query;
    const queryYear = parseInt(year) || new Date().getFullYear();
    
    try {
        const solutions = await OptimizationService.getSolutionsHistory(req.user.localityId, queryYear, scenario, cropVariant);

        return res.status(200).json(solutions);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}