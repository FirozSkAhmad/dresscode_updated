const mongoose = require("mongoose");
const crypto = require('crypto'); // Use crypto module for random string generation

const healSchema = new mongoose.Schema(
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
            enum: ['COATS', 'SCRUBS'],
        },
        subCategory: {
            type: String,
            required: true,
            trim: true,
            enum: ['MEDICAL COATS', 'DOCTOR COATS', 'NURSE SCRUB SETS', 'REGULAR SCRUB SETS'],
        },
        gender: {
            type: String,
            required: true,
            trim: true,
            enum: ['UNISEX', 'MEN', 'WOMEN'],
        },
        productType: {
            type: String,
            required: true,
            trim: true,
            enum: ['SHORT COATS', 'LONG COATS', 'TOP', 'PANT'],
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
        sleeves: {
            type: String,
            trim: true,
            enum: ["SHORT SLEEVES", "LONG SLEEVES"],
        },
        color: {
            type: String,
            enum: [
                "BLACK", "SAGE GREEN", "CHERRY LACQUER",
                "ELECTRIC INDIGO", "MAUVE", "CELESTIAL YELLOW",
                "DUSTED GRAPE", "SEPIA MIDNIGHT", "PLUM",
                "TERRACOTTA", "DIGITAL MIST"
            ]
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

healSchema.index({ productId: 1 });

module.exports = mongoose.model("Heals", healSchema);