const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const canalSchema = new Schema(
    {
        localityId: {
            type: mongoose.Types.ObjectId,
            ref: 'Locality',
        },
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
        coverage: [{
            barangay: {
                type: String,
                required: true,
            },
            fractionalAreaHa: {
                type: Number,
                required: true,
            },
            _id: false,
        }],
        lossFactor: {
            type: Number,
            default: 0.5,
        },
        netWaterDemandM3: {
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