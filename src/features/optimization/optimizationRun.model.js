const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const canalInputSchema = new Schema(
    {
        _id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        mainLateralId: {
            type: String,
            required: true,
        },
        tbsByDamHa: {
            type: Number,
            required: true,
        },
        netWaterDemandM3: {
            type: Number,
            required: true,
        },
        seepageM3: {
            type: Number,
            required: true,
        },
        lossFactorPercentage: {
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
    }, { _id: false }
)

const inputSnapshotSchema = new Schema(
    {
        scenario: {
            type: String,
            enum: ['dry season', 'wet season'],
            default: 'dry season'
        },
        cropVariant: {
            type: String,
            enum: ['main', 'second'],
            default: 'main'
        },
        totalSeasonalWaterSupplyM3: {
            type: Number,
            required: true,
        },
        readings: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
        },
        canalInput: [canalInputSchema],
    }, { _id: false }
)

const optimizationRunSchema = new Schema(
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
        triggeredBy: {
            _id: {
                type: mongoose.Schema.Types.ObjectId,
                required: true,
            },
            name: {
                type: String,
                required: true,
            },
            email: {
                type: String,
                required: true,
            },
            role: String
        },
        inputSnapshot: inputSnapshotSchema,
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending'
        },
    }, { timestamps: true }
)

optimizationRunSchema.index({
    triggeredBy: 1,
    createdAt: -1,
});
optimizationRunSchema.index({
    triggeredBy: 1,
    status: 1,
});
optimizationRunSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('OptimizationRun', optimizationRunSchema);