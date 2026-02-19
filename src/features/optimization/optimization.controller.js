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
       
        return res.status(200).json({ optimizationRun: optimizationDoc });
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
        paretoSolutions: { presence: true }
    });
    if (issues) return res.status(422).json({ error: issues });

    try {
        const { optimizationDoc, paretoDocs } = await OptimizationService.recieveAndProcessRunCallback(result);

        res.status(200).json({ optimizationRun: optimizationDoc, paretoSolutions: paretoDocs });
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}