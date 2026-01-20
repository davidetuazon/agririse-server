require('dotenv').config({ quiet: true });
const OptimizationService = require('./optimization.service');
const constraints = require('./optimization.validations');
const validate = require('validate.js');

exports.runOptimizationService = async (req, res, next) => {
    const params = {...req.body};
    const issues = validate(params, constraints.optimization);
    if (issues) return res.status(422).json({ error: issues });

    try {
        const optimizationInput = await OptimizationService.preProcessOptimizationInputs(req.user, params);
        // const { updatedOptimizationDoc, paretoDocs } = await OptimizationService.processOptimizationRun(req.user, optimizationInput);
       
        // return res.json({ optimizationRun: updatedOptimizationDoc, paretoSolutions: paretoDocs });

        const output = await OptimizationService.processOptimizationRun(req.user, optimizationInput);
        return res.json({ output });
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}