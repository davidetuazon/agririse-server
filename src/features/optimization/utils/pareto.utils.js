const deriveAllocationMetrics = (allocationVector) => {
    if (!Array.isArray(allocationVector)) return [];

    return allocationVector.map(alloc => {
        const shortfallM3 = alloc.netWaterDemandM3 - alloc.effectiveWaterM3;
        const shortfallPercentage = (shortfallM3 / alloc.netWaterDemandM3) * 100;
        const coveragePercentage =  100 - shortfallPercentage;

        return {
            ...alloc,
            shortfallM3,
            shortfallPercentage,
            coveragePercentage,
        }  
    });
}

module.exports = {
    deriveAllocationMetrics,
}