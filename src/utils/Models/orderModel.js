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
    },
    return: {
        type: Boolean,
        default: false
    },
    return_status:{
        type: String,
        default: 'N/A'
    }
});

const orderSchema = new mongoose.Schema({
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
        default: null
    },
    orderId: {
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
    deliveryCharges: {
        type: Number,
        default: 0
    },
    TotalAmount: { type: Number, required: true },
    TotalDiscountAmount: { type: Number, required: true },
    TotalPriceAfterDiscount: { type: Number, required: true },
    dateOfOrder: { type: Date, default: Date.now },
    length: { type: Number, required: true },
    breadth: { type: Number, required: true },
    height: { type: Number, required: true },
    weight: { type: Number, required: true },
    deliveryStatus: {
        type: String,
        required: true,
        // enum: ['Pending', 'Assigned',"Canceled"],
        default: 'Pending'
    },
    dateOfOrder: { type: Date, default: null },
    dateOfDelivery: { type: Date, default: null },
    estimatedDelivery: { type: Date, default: null },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Assigned'],
        default: 'Pending'
    },
    shiprocket_order_id: {
        type: Number,
        default: null
    },
    shiprocket_shipment_id: {
        type: Number,
        default: null
    },
    shiprocket_courier_id: {
        type: Number,
        default: null
    },
    shiprocket_awb_code: {
        type: String,
        default: null
    },
    pickup_scheduled_date: {
        type: String,
        default: null
    },
    pickup_token_number: {
        type: String,
        default: null
    }
});

orderSchema.index({ orderId: 1 })

module.exports = mongoose.model("Order", orderSchema);

