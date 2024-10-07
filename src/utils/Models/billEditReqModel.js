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

const billEditReqSchema = new mongoose.Schema({
    editBillReqId: {
        type: String,
        trim: true,
        unique: true,
        default: () => {
            return crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 6);
        },
    },
    bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' },
    storeId: { type: String, required: true, trim: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    TotalAmount: { type: Number, required: true },
    discountPercentage: { type: Number, required: true },
    priceAfterDiscount: { type: Number, required: true },
    isApproved: {
        type: Boolean,
        default: null
    },
    dateOfBill: {
        type: Date,
        default: null
    },
    dateOfValidate: {
        type: Date,
        default: null
    },
    dateOfBillEditReq: {
        type: Date,
        default: Date.now // Automatically sets the current date and time
    },
    reqNote: {
        type: String,
        default: null
    },
    validateNote: {
        type: String,
        default: null
    },
    approvedInvoiceUrl: {
        type: String,
        default: null
    },
    products: [productsSechma]
}, {
    timestamps: true,
});

// Indexes for optimized querying
billEditReqSchema.index({ editBillReqId: 1, storeId: 1 });

module.exports = mongoose.model('BillEditReq', billEditReqSchema);