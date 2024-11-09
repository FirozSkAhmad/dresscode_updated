const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
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
    status: {
        type: String,
        enum: ['pending', 'expired', 'used'],
        default: 'pending'
    },
    expiryDate: {
        type: Date,
        required: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    },
    usedDate: {
        type: Date,
        default: null // This will be set when the coupon status is changed to 'used'
    },
    linkedGroup: {
        type: String,
        default: null // Optional: Set default to null if not linked to a specific group
    },
    linkedProductId: {
        type: String,
        default: null // Optional: Set default to null if not linked to a specific product
    }
}, { timestamps: true }); // Enable timestamps for createdAt and updatedAt

// Middleware to set 'usedDate' when status is changed to 'used'
couponSchema.pre('save', function (next) {
    if (this.isModified('status') && this.status === 'used' && !this.usedDate) {
        this.usedDate = new Date();
    }
    next();
});

module.exports = mongoose.model("Coupon", couponSchema);

