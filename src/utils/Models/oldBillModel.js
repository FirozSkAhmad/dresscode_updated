const mongoose = require('mongoose');
const crypto = require('crypto'); // Use crypto module for random string generation

const variantSchema = new mongoose.Schema({
    color: {
        name: {
            type: String,
            required: true
        },
        hexcode: {
            type: String,
            default: null
        }
    },
    variantSizes: [{
        size: {
            type: String,
            required: true,
            trim: true
        },
        billedQuantity: {
            type: Number,
            required: true,
        },
        styleCoat: {
            type: String,
            trim: true,
        },
        sku: {
            type: String,
            trim: true
        },
    }],
    imageUrls: {
        type: [String],
    },
    isDeleted: {
        type: Boolean,
        required: true,
        default: false,
    },
    variantId: {
        type: String,
        required: true,
    },
});

// Indexing the variantId
variantSchema.index({ variantId: 1 }); // Create an index on variantId
variantSchema.index({ color: 1 }); // Create an index on color

const productsSechma = new mongoose.Schema(
    {
        productId: {
            type: String,
            trim: true
        },
        group: {
            type: String,
            required: true,
            trim: true,
            default: 'TOGS'
        },
        category: {
            type: String,
            required: true,
            trim: true
        },
        subCategory: {
            type: String,
            required: true,
            trim: true
        },
        gender: {
            type: String,
            required: true,
            trim: true
        },
        productType: {
            type: String,
            required: true,
            trim: true
        },
        fit: {
            type: String,
            required: true,
            trim: true,
        },
        neckline: {
            type: String,
            required: true,
            trim: true,
        },
        pattern: {
            type: String,
            required: true,
            trim: true,
        },
        sleeves: {
            type: String,
            required: true,
            trim: true,
        },
        material: {
            type: String,
            required: true,
            trim: true,
        },
        price: {
            type: Number,
            required: true,
            trim: true,
            default: null
        },
        productDescription: {
            type: String,
            trim: true,
            default: null
        },
        sizeChart: {
            type: String,
            trim: true,
            default: null
        },
        variants: [variantSchema]
    },
    {
        timestamps: true,
    }
);

const oldBillSchema = new mongoose.Schema({
    OldBillId: {
        type: String,
        trim: true,
        unique: true,
        default: () => {
            return crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 6);
        },
    },
    billId: { type: String, required: true, trim: true },
    invoiceNo: { type: String, required: true, trim: true },
    invoiceUrl: { type: String, required: true, trim: true, default: null },
    storeId: { type: String, required: true, trim: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    TotalAmount: { type: Number, required: true },
    discountPercentage: { type: Number, required: true },
    priceAfterDiscount: { type: Number, required: true },
    modeOfPayment: { type: String, required: true, trim: true, enum: ['CASH', 'UPI', 'CARD'] },
    isDeleted: {
        type: Boolean,
        default: false
    },
    dateOfDeletion: {
        type: Date,
        default: null
    },
    dateOfBill: {
        type: Date,
        default: Date.now // Automatically sets the current date and time
    },
    editStatus: { type: String, trim: true, enum: [null, 'PENDING', 'REJECTED', 'APPROVED'], default: null },
    products: [productsSechma]
}, {
    timestamps: true,
});

// Indexes for optimized querying
oldBillSchema.index({ billId: 1, storeId: 1 });
oldBillSchema.pre('save', function (next) {
    if (this.modeOfPayment) {
        this.modeOfPayment = this.modeOfPayment.toUpperCase();
    }
    next();
});

module.exports = mongoose.model('OldBill', oldBillSchema);