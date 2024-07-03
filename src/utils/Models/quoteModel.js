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
    quantityOrdered: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    logoUrl: {
        type: String, required: true, trim: true
    },
    logoPosition: {
        type: String, required: true, trim: true
    }
});

module.exports = mongoose.model("Quote", quoteSchema);