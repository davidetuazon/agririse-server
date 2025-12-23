const ParetoSolutionModel = require('./paretoSolution.model');
const OptimizationRunModel = require('./optimizationRun.model');
const IoTService = require('../iot/iot.service');

// improve by:
// can do better error handling
exports.processOptimizationRun = async (user, data) => {
    if (!data) throw { status: 400, message: 'Missing request body' };

    try {
        const userSnapshot = {
            _id: user._id,
            name: user.fullName,
            email: user.email,
            role: user.role,
        }
        const inputSnapshot = await IoTService.getLatestReadings(user.localityId);

        // create new optimization doc
        const optimizationDoc = await OptimizationRunModel.create({
            localityId: user.localityId,
            triggeredBy: userSnapshot,
            // improve time window handling
            timeWindow: {
                from: Date.now(),
                to: Date.now(),
            },
            inputSnapshot,
            // set initial status to pending
            status: 'pending'
        });
        if (!optimizationDoc) throw { status: 400, message: 'Failed to generate optimization run.' };

        // call GA service
        const response = await fetch(process.env.GA_SERVICE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const output = await response.json();

        // update status once request is completed
        const updatedOptimizationDoc = await OptimizationRunModel.findByIdAndUpdate(
                optimizationDoc._id,
                {status: output.status},
                { new: true }
            );

        if (!Array.isArray(output.paretoSolutions) || output.paretoSolutions.length === 0) throw { status: 400, message: 'Service returned no solutions' };
         // create pareto solution docs
        const paretoDocs = [];
        for (const sol of output.paretoSolutions) {
            const doc = await ParetoSolutionModel.create({
                runId: updatedOptimizationDoc._id,
                allocationVector: sol.allocationMatrix,
                objectiveValues: sol.objectiveValues,
            });
            
            if (!doc) throw { status: 400, message: 'Failed to save generated pareto solutions.' };
            paretoDocs.push(doc);
        }

        return { updatedOptimizationDoc, paretoDocs };
    } catch (e) {
        throw(e);
    }
}