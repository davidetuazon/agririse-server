const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const localitySchema = new Schema(
    {
        deleted: {
            type: Boolean,
            default: false,
        },
        city: {
            type: String,
            required: true,
        },
        province: {
            type: String,
            required: true,
        },
        region: {
            type: String,
            required: true,
        },
        canals: [{
            type: mongoose.Types.ObjectId,
            ref: 'Canal'
        }],
        totalServiceAreaHA: {
            type: Number,
            unit: 'Hectares',
            default: 0,
        },
        totalAreaNetwaterDemandM3: {
            type: Number,
            unit: 'm³',
            default: 0,
        },
    }, { timestamps: true }
);

localitySchema.plugin(mongoosePaginate);
module.exports = mongoose.model('Locality', localitySchema);