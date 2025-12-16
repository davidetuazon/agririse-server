const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const sensorReadingSchema = new Schema(
    {
        localityId: {
            type: mongoose.Types.ObjectId,
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
            enum: ['mock', 'iot'],
            default: 'mock',
        },
    }, { timestamps: true }
);

module.exports = mongoose.model('SensorReading', sensorReadingSchema);