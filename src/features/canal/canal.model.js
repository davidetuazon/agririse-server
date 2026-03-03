const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const canalSchema = new Schema(
    {
        deleted: {
            type: Boolean,
            default: false,
        },
        localityId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Locality',
            required: true,
        },
        mainLateralId: {
            type: String,
            required: true,
        },
        subLateral: [String],
        barangays: [String],
        canalDimensions: {
          base: {
            type: Number,
            required: true,
          },
          waterDepth: {
            type: Number,
            required: true,
          },
        },
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
        seepageM3: {
            type: Number,
            default: 0,
        },
        lossFactorPercentage: {
            type: Number,
            default: 0,
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
canalSchema.index({
    deleted: 1,
    localityId: 1,
})

module.exports = mongoose.model('Canal', canalSchema);