const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const runSnapshotSchema = new Schema(
    {
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
        inputSnapshot: {
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
        },
        createdAt: {
            type: Date,
            required: true,
        }
    }, { _id: false }
)
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

const solutionSnapshotSchema = new Schema(
    {
        allocationVector: [
            {
                mainLateralId: {
                    type: String,
                    required: true,
                },
                areaHa: {
                    type: Number,
                    required: true,
                },
                allocatedWaterM3: {
                    type: Number,
                    required: true,
                },
                effectiveWaterM3: {
                    type: Number,
                    required: true,
                },
                netWaterDemandM3: {
                    type: Number,
                    required: true,
                },
                shortfallM3: {
                    type: Number,
                    required: true,
                },
                shortfallPercentage: {
                    type: Number,
                    required: true,
                },
                coveragePercentage: {
                    type: Number,
                    required: true,
                }
            }
        ],
        objectiveValues: {
            type: Map,
            of: objectiveValuesSchema,
            required: true,
        },
    }, { _id: false }
)

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
            required: true,
        },
        runSnapshot: runSnapshotSchema,
        solutionSnapshot: solutionSnapshotSchema,
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
}, { unique: true });
selectedSolutionSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('SelectedSolution', selectedSolutionSchema);