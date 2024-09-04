const mongoose = require('mongoose');
const crypto = require('crypto'); // Use crypto module for random string generation

const boxSchema = new mongoose.Schema({
    predefinedId: {
        type: String,
        trim: true,
        unique: true,
        default: () => {
            return crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 6);
        },
    },
    boxLength: {
        type: Number,
        required: true
    },
    boxBreadth: {
        type: Number,
        required: true
    },
    boxHeight: {
        type: Number,
        required: true
    }
});
boxSchema.index({ predefinedId: 1 });

module.exports = mongoose.model("Box", boxSchema);