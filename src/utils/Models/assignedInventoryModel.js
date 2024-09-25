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

// Define the Assigned History Schema
const assignedInventorySchema = new mongoose.Schema({
    assignedInventoryId: {
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
    assignedDate: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    receivedDate: {
        type: String,
        default: null
    },
    totalAmountOfAssigned: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        required: true,
        default: 'ASSIGNED',
        enum: ['ASSIGNED', 'RECEIVED']
    },
    products: [productsSechma] // Array of product and their variants
});

assignedInventorySchema.index({ assignedInventoryId: 1 });

module.exports = mongoose.model('AssignedInventory', assignedInventorySchema);

