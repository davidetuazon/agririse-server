const ParetoSolutionModel = require('./paretoSolution.model');
const OptimizationRunModel = require('./optimizationRun.model');
const CanalModel = require('../../features/canal/canal.model');
const IoTService = require('../iot/iot.service');
const { GAInputProcessing } = require('./optimization.utils');

exports.preProcessOptimizationInputs = async (user, params) => {
    if (!params) throw { status: 400, message: 'Missing administrator level inputs' };
    const { totalSeasonalWaterSupplyM3, scenario } = params;

    try {
        const canals = await CanalModel.find({ deleted: false, localityId: user.localityId });
        if (!Array.isArray(canals) || canals.length === 0) throw { status: 404, message: 'No canals found for this locality' };

        let cropVariant;
        const cleanedCanalInputs = canals.map(canal => {
            if (!canal.mainLateralId || typeof canal.netWaterDemandM3 != 'number') throw { status: 422, message: `Invalid canal: ${JSON.stringify(canal)}` };

            cropVariant = scenario === 'dry season' ? canal.cropVariant[0] : canal.cropVariant[1];

            return {
                _id: canal._id,
                mainLateralId: canal.mainLateralId,
                tbsByDamHa: canal.tbsByDamHa,
                netWaterDemandM3: canal.netWaterDemandM3,
                seepageM3: canal.seepageM3,
                lossFactorPercentage: canal.lossFactorPercentage,
                coverage: canal.coverage,
            };
        });

        return {
            locality: user.localityId,
            scenario,
            cropVariant,
            totalSeasonalWaterSupplyM3,
            canalInput: cleanedCanalInputs,
        };
    } catch (e) {
        throw(e);
    } 
}

// improve by:
// can do better error handling
exports.processOptimizationRun = async (user, optimizationInput) => {
    if (!optimizationInput) throw { status: 400, message: 'Missing request body' };

    try {
        // Optimization Input Documentation
        const userSnapshot = {
            _id: user._id,
            name: user.fullName,
            email: user.email,
            role: user.role,
        }
        const latest = await IoTService.getLatestReadings(user.localityId);
        const inputSnapshot = { readings: latest.readings, ...optimizationInput }

        // create new optimization doc
        const optimizationDoc = await OptimizationRunModel.create({
            localityId: user.localityId,
            triggeredBy: userSnapshot,
            inputSnapshot,
            // set initial status to pending
            status: 'pending'
        });
        if (!optimizationDoc) throw { status: 400, message: 'Failed to generate optimization run.' };


        // Python Service Contract
        const cleanedGAInputs = GAInputProcessing(latest.readings, optimizationInput);
        // call GA service
        const response = await fetch(process.env.GA_SERVICE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cleanedGAInputs)
        });
        const output = await response.json();
        
        // return output;

        // ParetoSolution Documentation and Optimization Input Document Updates
        const updatedOptimizationDoc = await OptimizationRunModel.findByIdAndUpdate(
            optimizationDoc._id,
            {status: output.status}, // update status once request is completed
            { new: true }
        );

        if (!Array.isArray(output.paretoSolutions) || output.paretoSolutions.length === 0) {
            throw { status: 400, message: 'Service returned no solutions' };
        }
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