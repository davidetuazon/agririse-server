const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema(
    {
        deleted: {
            type: Boolean,
            default: false,
        },
        fullName: String,
        role: {
            type: String,
            enum: ['admin', 'staff'],
            default: 'staff',
        },
        email: {
            type: String,
            lowercase: true,
            trim: true,
            unique: true,
            match: [/\S+@\S+\.\S+/, 'Please use a valid email address'],
        },
        password: {
            type: String,
            required: true,
        },
        lastLogin: {
            type: Date,
            default: null,
        }
    }, { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);