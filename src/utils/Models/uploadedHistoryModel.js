const mongoose = require("mongoose");
const crypto = require('crypto');

// Define the ProductVariant reference schema
const productsSchema = new mongoose.Schema({
    group: { type: String, required: true, trim: true },
    productId: { type: String, required: true, trim: true },
    variants: [{
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
        variantSizes: [{
            size: {
                type: String,
                required: true,
                trim: true,
            },
            quantityOfUpload: {
                type: Number,
                required: true,
                min: 1,
            },
            styleCoat: { type: String, required: true, trim: true },
            sku: { type: String, required: true, trim: true },
        }]
    }],
});

// Define the Assigned History Schema
const uploadedHistorySchema = new mongoose.Schema({
    uploadedId: {
        type: String,
        trim: true,
        unique: true,
        default: () => {
            return crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 6);
        },
    },
    uploadedDate: {
        type: Date,
        default: Date.now
    },
    totalAmountOfUploaded: {
        type: Number,
        required: true
    },
    products: [productsSchema] // Array of product and their variants
});

uploadedHistorySchema.index({ uploadedId: 1 });

module.exports = mongoose.model('UploadedHistory', uploadedHistorySchema);

