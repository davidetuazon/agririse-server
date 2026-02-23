const CanalModel = require('./canal.model');
const { basicAggregation, performanceMetrics } = require('./utils/analytics.util');
const CONSTANTS = require('../../shared/helpers/constants');

exports.getCanalOverview = async (localityId) => {
    const canals = await CanalModel.find({
        localityId,
        deleted: false,
    }).select(CONSTANTS.CANAL_FIELD);
    if (!canals || canals.length === 0) throw { status: 404, message: 'No canals found for current locality' };

    // perform basic aggregation metric for overview
    const overview = basicAggregation(canals);
    
    return {
        overview,
        canals,
    };
}