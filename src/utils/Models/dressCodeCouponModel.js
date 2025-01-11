const mongoose = require('mongoose');

const dresscodeCouponSchema = new mongoose.Schema({
    couponCode: {
        type: String,
        required: true,
        unique: true
    },
    discountPercentage: {
        type: Number,
        required: true,
        min: 1,
        max: 100
    },
    expiryDate: {
        type: Date,
        required: true
    },
    isSingleUse: {
        type: Boolean,
        required: true,
        default: true // Default to single use
    },
    usedBy: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', // Reference to the User model
            required: true
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order', // Reference to the Order model
            required: true
        },
        usedDate: {
            type: Date,
            default: Date.now // This will be set when the coupon status is changed to 'used'
        }
    }]
}, { timestamps: true }); // Enable timestamps for createdAt and updatedAt

module.exports = mongoose.model("DresscodeCoupon", dresscodeCouponSchema);