const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const optimizationRunSchema = new Schema(
    {
        triggeredBy: {
            _id: {
                type: mongoose.Types.ObjectId,
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
        timeWindow: {
            from: {
                type: Date,
                default: Date.now,
            },
            to: {
                type: Date,
                required: true,
            }
        },
        inputSnapshot: {
            type: mongoose.Types.Mixed,
            required: true,
        },
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