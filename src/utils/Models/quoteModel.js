const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    group: { type: String, required: true, trim: true },
    productId: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true },
    size: { type: String, required: true, trim: true },
    quantityRequired: { type: Number, required: true, min: 100 },
    logoUrl: {
        type: String, trim: true, default: null
    },
    logoPosition: {
        type: String, trim: true, default: null
    }
});

module.exports = mongoose.model("Quote", quoteSchema);