const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const allocationUnitSchema = new Schema(
    {
        deleted: {
            type: Boolean,
            default: false,
        },
        mainLateralId: {
            type: String,
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
            }
        }],
        areaHa: {
            type: Number,
            required: true,
        },
        allocatedWaterM3: {
            type: Number,
            required: true,
        },
    }, { _id: false }
);

const objectiveValuesSchema = new Schema(
    {
        value: {
            type: Number,
            required: true,
        },
        unit: {
            type: String,
            required: true,
        },
        direction: {
            type: String,
            enum: ['maximize', 'minimize'],
            default: 'minimize',
        }
    }, { _id: false }
);

const paretoSolutionSchema = new Schema(
    {
        runId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'OptimizationRun',
            required: true,
        },
        allocationVector: [allocationUnitSchema],
        objectiveValues: {
            type: Map,
            of: objectiveValuesSchema,
            required: true,
        },
    }, { timestamps: true }
)

paretoSolutionSchema.index({
    runId: 1,
    createdAt: 1,
});
paretoSolutionSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('ParetoSolution', paretoSolutionSchema);