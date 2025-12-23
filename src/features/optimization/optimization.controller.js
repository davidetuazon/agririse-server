require('dotenv').config({ quiet: true });
const OptimizationService = require('./optimization.service');

const validate = require('validate.js');

// TODO:
// write service that saves GA generated solutions to db once inputs are finalized
exports.runOptimizationService = async (req, res, next) => {
    const params = {...req.body};
    const issues = validate(params, { presence: true }); // write proper validations once inputs are finalized
    if (issues) return res.status(422).json({ error: issues });

    try {
        const response = await fetch(process.env.GA_SERVICE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });

        const data = await response.json();
        const { optimizationDoc, paretoDocs } = await OptimizationService.saveOutputGA(req.user, data);
        
        return res.json({ optimizationRun: optimizationDoc, paretoSolutions: paretoDocs });
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}