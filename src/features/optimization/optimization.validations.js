
const optimization = {
    totalSeasonalWaterSupplyM3: {
        presence: { allowEmpty: false, message: 'is required.' },
        numericality: {
            onlyInteger: false,  // allow decimals
            greaterThan: 0,
            message: 'Total seasonal water supply must be a positive number.'
        }
    },
    scenario: {
        presence: { allowEmpty: false, message: 'is required.' },
        inclusion: {
            within: ['dry season', 'wet season'],
            message: '^%{value} is not a valid scenario.'
        },
    },
}

module.exports = {
    optimization,
}