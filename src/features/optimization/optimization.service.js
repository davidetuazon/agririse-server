const ParetoSolutionModel = require('./paretoSolution.model');
const OptimizationRunModel = require('./optimizationRun.model');
const IoTService = require('../iot/iot.service');

exports.saveOutputGA = async (user, data) => {
    if (!data) throw { status: 400, message: 'Missing request body' };

    try {
        const userSnapshot = {
            _id: user._id,
            name: user.fullName,
            email: user.email,
            role: user.role,
        }
        
        const inputSnapshot = await IoTService.getLatestReadings(user.localityId);

        const optimizationDoc = await OptimizationRunModel.create({
            localityId: user.localityId,
            triggeredBy: userSnapshot,
            timeWindow: {
                from: Date.now(),
                to: Date.now(),
            },
            inputSnapshot,
            status: data.status,
        });
        if (!optimizationDoc) throw { status: 400, message: 'Failed to save optimization run' };

        const paretoDocs = [];
        // improve by:
        // handling multiple pareto solutions instead of just one
        const doc = await ParetoSolutionModel.create({
            runId: optimizationDoc._id,
            allocationVector: data.allocationMatrix,
            objectiveValues: data.objectiveValues,
        });
        if (!doc) throw { status: 400, message: 'Failed to save generated pareto solutions' };
        paretoDocs.push(doc);

        return { optimizationDoc, paretoDocs };
    } catch (e) {
        throw(e);
    }
}