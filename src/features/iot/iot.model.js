const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const sensorReadingSchema = new Schema(
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
        value: {
            type: Number,
            required: true,
        },
        unit: {
            type: String,
            required: true,
        },
        recordedAt: {
            type: Date,
            default: Date.now,
        },
        source: {
            type: String,
            enum: ['mock', 'iot', 'import', 'forecast'],
            default: 'mock',
        },
    }, { timestamps: true }
);

sensorReadingSchema.index({
    localityId: 1,
    sensorType: 1,
    recordedAt: 1,
});

module.exports = mongoose.model('SensorReading', sensorReadingSchema);