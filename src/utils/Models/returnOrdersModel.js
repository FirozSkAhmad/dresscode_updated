const mongoose = require('mongoose');
const crypto = require('crypto');

const productsSchema = new mongoose.Schema({
    group: { type: String, required: true, trim: true },
    productId: { type: String, required: true, trim: true },
    color: {
        name: {
            type: String,
            required: true,
            trim: true
        },
        hexcode: {
            type: String,
            trim: true
        }
    },
    size: { type: String, required: true, trim: true },
    quantityOrdered: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    imgUrl: {
        type: String, trim: true, default: null
    },
    logoUrl: {
        type: String, trim: true, default: null
    },
    name: {
        type: String, trim: true, default: null
    },
    logoPosition: {
        type: String, trim: true, default: null
    },
    discountPercentage: {
        type: Number,
        default: 0
    },
    discountAmount: {
        type: Number,
        default: 0
    }
});

const returnOrderSchema = new mongoose.Schema({
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
        default: null
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    },
    returnOrderId: {
        type: String,
        trim: true,
        unique: true,
        default: () => {
            // Generate a random 6 character alphanumeric string
            return crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
        },
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    address: {  // Add this to reference the address within the User's addresses
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User.addresses',
        required: true
    },
    products: [productsSchema],
    TotalAmount: { type: Number, required: true },
    TotalDiscountAmount: { type: Number, required: true },
    TotalPriceAfterDiscount: { type: Number, required: true },
    length: { type: Number, required: true },
    breadth: { type: Number, required: true },
    height: { type: Number, required: true },
    weight: { type: Number, required: true },
    returnStatus: {
        type: String,
        required: true,
        default: 'Pending'
    },
    refund_payment_status: {
        type: String,
        default: 'Pending'
    },
    dateOfReturnGenerated: { type: Date, default: Date.now },
    dateOfReturned: { type: Date, default: null },
    shiprocket_shipment_id: {
        type: Number,
        default: null
    },
    shiprocket_awb_code: {
        type: String,
        default: null
    },
});

returnOrderSchema.index({ orderId: 1 })

module.exports = mongoose.model("ReturnOrders", returnOrderSchema);