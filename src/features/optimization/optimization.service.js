const ParetoSolutionModel = require('./paretoSolution.model');
const OptimizationRunModel = require('./optimizationRun.model');
const SelectedSolutionModel = require('./selectedSolution.model');
const CanalModel = require('../../features/canal/canal.model');
const IoTService = require('../iot/iot.service');
const { GAInputProcessing } = require('./optimization.utils');
const { RUN_DOC_FIELD } = require('../../shared/helpers/constants');
const { deriveAllocationMetrics } = require('./utils/pareto.utils');

exports.prepareRunInput = async (user, params) => {
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

        const totalNetWaterDemandM3 = cleanedCanalInputs.reduce((sum, c) => sum + c.netWaterDemandM3, 0);
        if (totalSeasonalWaterSupplyM3 < totalNetWaterDemandM3 / 2) {
            const supplyThreshold = totalNetWaterDemandM3 / 2;
            const deficit = supplyThreshold - totalSeasonalWaterSupplyM3;

            throw {
                status: 400,
                message: `Water supply (${totalSeasonalWaterSupplyM3.toLocaleString()} m³) is below the minimum threshold of 50% of total net water demand (${supplyThreshold.toLocaleString()} m³). Shortfall: ${deficit.toLocaleString()} m³. Unable to provide meaningful optimization.`
            }
        }

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
exports.initiateRun = async (user, optimizationInput) => {
    if (!optimizationInput) throw { status: 400, message: 'Missing request body' };

    try {
        // Optimization Input Documentation
        const userSnapshot = {
            _id: user._id,
            name: user.fullName,
            email: user.email,
            role: user.role,
        }
        const latest = await IoTService.getLatestReadings(user);
        const reshapedReadings = Object.fromEntries(
            Object.entries(latest.readings).map(([key, val]) => [
                key,
                {
                    value: val.value,
                    unit: val.unit,
                    recordedAt: val.recordedAt,
                    sensorType: val.sensorType,
                }
            ])
        );
        const inputSnapshot = { readings: reshapedReadings, ...optimizationInput }

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

        // call GA service - fire and forget
        fetch(process.env.GA_SERVICE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...cleanedGAInputs,
                runId: optimizationDoc._id.toString() // pass runId to service for context
            })
        });

        return optimizationDoc;
    } catch (e) {
        throw(e);
    }
}

exports.receiveAndProcessRunCallback = async (result) => {
    if (!result) throw { status: 400, message: 'Missing response from optimization service' };
    
    if (result.status !== 'failed') {
        if (!Array.isArray(result.paretoSolutions) || result.paretoSolutions.length === 0) throw { status: 400, message: 'Invalid or missing pareto solutions in payload' };
    }

    try {
        const optimizationDoc = await OptimizationRunModel.findByIdAndUpdate(result.runId, { status: result.status }, { new: true });
        if (!optimizationDoc) throw { status: 404, message: 'Optimization run not found' };
        
        if (result.status === 'failed' ) return { optimizationDoc, message: 'GA optimization failed' };

        const docs = result.paretoSolutions.map(sol => ({
            runId: optimizationDoc._id,
            allocationVector: sol.allocationVector,
            objectiveValues: sol.objectiveValues,
        }));
        await ParetoSolutionModel.insertMany(docs);

        return { success: true };
    } catch (e) {
        console.error('Error in recieveAndProcessRunCallback:', e);
        throw(e);
    }
}

exports.pollRunStatus = async (userId, runId) => {
    if (!runId) throw { status: 400, message: 'Missing query parameters' };

    const optimizationDoc = await OptimizationRunModel.findOne({
        deleted: false,
        _id: runId,
        "triggeredBy._id": userId,
    }).lean();
    if(!optimizationDoc) throw { status: 404, message: 'No Optimization Run document found' };

    return { status: optimizationDoc.status }
}

exports.getRunResults = async (localityId, runId) => {
    if (!runId) throw { status: 400, message: 'Missing query parameters' };

    const runDoc = await OptimizationRunModel.findById(runId).select(RUN_DOC_FIELD);
    if (!runDoc) throw { status: 404, message: 'Run data not found' };

    if (!runDoc.localityId.equals(localityId)) throw { status: 403, message: 'Unauthorized' };

    if (runDoc.status === 'completed') {
        const paretoFront = await ParetoSolutionModel
            .find({ runId })
            .select('-__v -createdAt -updatedAt -deleted')
            .lean();
        if (paretoFront.length === 0) throw { status: 404, message: 'No pareto front solutions found for this run' };

        const paretoWithAddedMetrics = paretoFront.map(pareto => {
            return {
                ...pareto,
                allocationVector: deriveAllocationMetrics(pareto.allocationVector),
            }
        });
        return { optimizationRun: runDoc, paretoSolutions: paretoWithAddedMetrics };
    }

    return { optimizationRun: runDoc, message: 'Run either failed or solutions are still being generated' };
}

exports.saveSelectedSolution = async (user, runId, solutionId) => {
    if (!runId || !solutionId) throw { status: 400, message: 'Missing request body' };

    const runDoc = await OptimizationRunModel.findOne({ _id: runId, localityId: user.localityId });
    if (!runDoc) throw { status: 404, message: 'Run data not found' };

    const solutionDoc = await ParetoSolutionModel.findOne({ _id: solutionId, runId }).lean();
    if (!solutionDoc) throw { status: 400, message: 'Solution is not part of this run' };

    const runSnapshot = {
        triggeredBy: runDoc.triggeredBy,
        inputSnapshot: runDoc.inputSnapshot,
        createdAt: runDoc.createdAt,
    };
    const solutionSnapshot = {
        allocationVector: deriveAllocationMetrics(solutionDoc.allocationVector),
        objectiveValues: solutionDoc.objectiveValues,
    }
    const selectedBy = {
        _id: user._id,
        name: user.fullName,
        email: user.email,
        role: user.role,
    }

    const selected = await SelectedSolutionModel.create({
        localityId: user.localityId,
        runId,
        runSnapshot,
        solutionSnapshot,
        selectedBy,
    });
    if (!selected) throw { status: 400, message: 'Failed to save selected solution' };

    return { success: true };
}

exports.getSolutionsHistory = async (localityId, year, scenario, cropVariant) => {

    const parsedYear = parseInt(year);
    if (isNaN(parsedYear)) throw { status: 400, message: 'Invalid year format' };

    const startOfYear = new Date(`${parsedYear}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${parsedYear}-12-31T23:59:59.999Z`);

    const filter = {
        localityId,
        createdAt: {
            $gte: startOfYear,
            $lte: endOfYear
        },
        ...(scenario && { 'runSnapshot.inputSnapshot.scenario': scenario }),
        ...(cropVariant && { 'runSnapshot.inputSnapshot.cropVariant': cropVariant })
    };

    const solutions = await SelectedSolutionModel.find(filter).sort({ createdAt: -1 }).select('-__v -updatedAt').lean();
    if (solutions.length === 0) {
        const filterParts = [];
        if (scenario) filterParts.push(`scenario: ${scenario}`);
        if (cropVariant) filterParts.push(`cropVariant: ${cropVariant}`);
        
        const filterDescription = filterParts.length > 0 ? ` with ${filterParts.join(', ')}` : '';

        throw { status: 404, message: `No solutions found for year ${parsedYear}${filterDescription}` };
    }

    return solutions;
}