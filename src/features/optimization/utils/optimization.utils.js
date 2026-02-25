const GAInputProcessing = (readings, input) => {
    if (!readings || !input) return;

     const processedReadings = {};
    for (const key in readings) {
        processedReadings[key] = readings[key].value;
    }

    const payload = {
        scenario: input.scenario,
        cropVariant: input.cropVariant,
        totalSeasonalWaterSupplyM3: input.totalSeasonalWaterSupplyM3,
        readings: processedReadings,
        canalInput: input.canalInput,
    };

    return payload;
};

module.exports = {
    GAInputProcessing,
}