const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const alertSchema = new Schema(
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
        sensorType: {
            type: String,
            enum: ['rainfall', 'humidity', 'temperature', 'damWaterLevel'],
            required: true,
        },
        severity: {
            type: String,
            enum: ['critical', 'warning', 'info'],
            required: true,
        },
        type: {
            type: String,
            required: true,
        },
        value: {
            type: Number,
            required: true,
        },
        threshold: Number,
        previousValue: Number,
        percentChange: Number,
        message: { type: String, required: true },
        readingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SensorReading',
            required: true,
        },
        acknowledged: {
            type: Boolean,
            default: false
        },
        acknowledgedAt: Date,
        acknowledgedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }, { timestamps: true },
)
alertSchema.index({
    localityId: 1,
})

module.exports = mongoose.model('Alert', alertSchema);