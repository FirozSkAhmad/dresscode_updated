const mongoose = require("mongoose");
const crypto = require('crypto'); // Use crypto module for random string generation

const healCoatsSchema = new mongoose.Schema(
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
            default: 'HEAL'
        },
        category: {
            type: String,
            required: true,
            trim: true,
            default: 'COATS'
        },
        subCategory: {
            type: String,
            required: true,
            trim: true,
            enum: ['MEDICAL COATS', 'DOCTOR COATS'],
        },
        fit: {
            type: String,
            required: true,
            trim: true,
            default: 'CLASSIC'
        },
        size: {
            type: String,
            required: true,
            trim: true,
            enum: ["XS", "S", "M", "L", "XL", "XXL"],
        },
        typeOfCoats: {
            type: String,
            required: true,
            trim: true,
            enum: ["SHORT COATS", "LONG COATS"],
        },
        sleeves: {
            type: String,
            required: true,
            trim: true,
            enum: ["SHORT SLEEVES", "LONG SLEEVES"],
        },
        fabric: {
            type: String,
            required: true,
            trim: true,
            enum: ["POLY COTTON", "LAB COATS"],
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

healCoatsSchema.index({ productId: 1 });

module.exports = mongoose.model("HealCoats", healCoatsSchema);
