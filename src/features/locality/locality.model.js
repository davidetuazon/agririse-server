const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const localitySchema = new Schema(
    {
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
    }, { timestamps: true }
);

localitySchema.plugin(mongoosePaginate);
module.exports = mongoose.model('Locality', localitySchema);