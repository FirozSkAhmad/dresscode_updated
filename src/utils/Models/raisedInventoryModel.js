const mongoose = require("mongoose");
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
        quantity: {
            type: Number,
            required: true,
        },
        styleCoat: {
            type: String,
            trim: true,
            unique: true,
        },
        sku: {
            type: String,
            trim: true
        },
        isCompleted: {
            type: Boolean,
            default: false,
        }
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
        unique: true,
    },
});

// Indexing the variantId
variantSchema.index({ variantId: 1 }); // Create an index on variantId
variantSchema.index({ color: 1 }); // Create an index on color

const productsSechma = new mongoose.Schema(
    {
        productId: {
            type: String,
            trim: true,
            unique: true
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

// Define the Assigned History Schema
const raisedInventorySchema = new mongoose.Schema({
    raisedInventoryId: {
        type: String,
        trim: true,
        unique: true,
        default: () => {
            return crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 6);
        },
    },
    storeId: {
        type: String,
        required: true,
    },
    storeName: {
        type: String,
        required: true,
    },
    raisedDate: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    approvedDate: { 
        type: String,
        default: null
    },
    rejectedDate: {
        type: String,
        default: null
    },
    receivedDate: {
        type: String,
        default: null
    },
    totalAmountRaised: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        required: true,
        default: 'ASSIGNED',
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'RECEIVED', 'DRAFT']
    },
    products: [productsSechma] // Array of product and their variants
});

raisedInventorySchema.index({ assignedInventoryId: 1 });

module.exports = mongoose.model('RaisedInventory', raisedInventorySchema);