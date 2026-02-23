const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const selectedSolutionSchema = new Schema(
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
        runId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'OptimizationRun',
            unique: true,
            required: true,
        },
        solutionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ParetoSolution',
            required: true,
        },
        selectedBy: {
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
        notes: {
            type: String,
            default: null,
        }
    }, { timestamps: true }
)
selectedSolutionSchema.index({
    localityId: 1,
    runId: 1,
});
selectedSolutionSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('SelectedSolution', selectedSolutionSchema);