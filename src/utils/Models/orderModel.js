const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
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
    deliveryCharges: {
        type: Number,
        required: true,
        default: 50
    },
    discountPercentage: {
        type: Number,
        required: true,
        default: null
    },
    TotalPriceAfterDiscount: { type: Number, required: true },
    dateOfOrder: { type: Date, default: Date.now },
    deliveryStatus: {
        type: String,
        required: true,
        enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Pending'
    },
    dateOfDelivery: { type: Date, default: null },
    estimatedDelivery: { type: Date, default: null }
});

module.exports = mongoose.model("Order", orderSchema);

