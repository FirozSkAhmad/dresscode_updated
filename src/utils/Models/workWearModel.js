const mongoose = require("mongoose");
const crypto = require('crypto');

const workWearSchema = new mongoose.Schema(
    {
        productId: {
            type: String,
            trim: true,
            unique: true,
            default: () => {
                // Generate a random 6 character alphanumeric string
                return crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
            },
        },
        group: {
            type: String,
            required: true,
            trim: true,
            default: 'WORK WEAR UNIFORMS'
        },
        category: {
            type: String,
            required: true,
            trim: true,
            enum: ['AUTOMOBILE UNIFORM', 'ENERGY UNIFORMS', 'REFLECTIVE UNIFORMS']
        },
        gender: {
            type: String,
            required: true,
            trim: true,
            enum: ['MEN', 'WOMEN']
        },
        productType: {
            type: String,
            required: true,
            trim: true,
            enum: ['SHIRT', 'T-SHIRT', 'TROUSER', 'OVERALLS']
        },
        size: {
            type: String,
            required: true,
            trim: true,
            enum: ['S', 'M', 'L', 'XL', 'XXL'],
        },
        fit: {
            type: String,
            required: true,
            trim: true,
            default: 'CLASSIC FIT'
        },
        quantity: {
            type: Number,
            required: true,
            default: 100
        },
        images: {
            type: [String]
        }
    },
    {
        timestamps: true,
    }
);

workWearSchema.index({ productId: 1 });

module.exports = mongoose.model("WorkWear", workWearSchema);
