const basicAggregation = (canals) => {

        const totalCanals = canals.length;
        const totalServiceAreaHa = canals.reduce((sum, c) => sum + c.tbsByDamHa, 0);
        const totalNetWaterDemandM3 = canals.reduce((sum, c) => sum + c.netWaterDemandM3, 0);
        const totalSeepageM3 = canals.reduce((sum, c) => sum + c.seepageM3, 0);
        const totalCanalDistanceKm =  canals.reduce((sum, c) => sum + c.totalCanalDistanceKm, 0);

        // do rounding for these in frontend
        const systemLevelLossFactorPercentage = ((totalSeepageM3 / (totalNetWaterDemandM3 + totalSeepageM3)) * 100);
        const avgCanalLossFactorPercentage = (canals.reduce((sum, c) => sum + c.lossFactorPercentage, 0) / totalCanals);
        const avgSeepPerKm = (totalSeepageM3 / totalCanalDistanceKm);

        const sortedByLoss = [...canals].sort((a, b) =>
            a.lossFactorPercentage - b.lossFactorPercentage
        );
        const mostEfficientCanal = {
            id: sortedByLoss[0].mainLateralId,
            lossFactorPercentage: sortedByLoss[0].lossFactorPercentage
        };
        const leastEfficientCanal = {
            id: sortedByLoss[totalCanals - 1].mainLateralId,
            lossFactorPercentage: sortedByLoss[totalCanals - 1].lossFactorPercentage
        };

        return {
            totalCanals,
            totalServiceAreaHa,
            totalNetWaterDemandM3,
            totalSeepageM3,
            totalCanalDistanceKm,
            systemLevelLossFactorPercentage,
            avgCanalLossFactorPercentage,
            avgSeepPerKm,
            mostEfficientCanal,
            leastEfficientCanal,
        }
}


module.exports = {
    basicAggregation,
}