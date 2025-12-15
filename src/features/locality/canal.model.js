const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const canalSchema = new Schema(
    {
        mainLateralId: {
            type: String,
            required: true,
        },
        subLateral: [String],
        barangays: [String],
        totalCanalDistanceKm: {
            type: Number,
            required: true,
        },
        tbsByDamHa: {
            type: Number,
            required: true,
        },
        lossFactor: {
            type: Number,
            default: 0.5,
        },
        waterDemand: {
            type: Number,
            default: 0,
        },
        cropVariant: [{
            type: String,
            required: true,
        }],
        growthStage: [{
            type: String,
            required: true,
        }],
    }, { timestamps: true }
)

module.exports = mongoose.model('Canal', canalSchema);