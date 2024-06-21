const mongoose = require("mongoose");
const crypto = require('crypto');

const togsSchema = new mongoose.Schema(
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
            default: 'TOGS'
        },
        category: {
            type: String,
            required: true,
            trim: true,
            default: 'SCHOOL UNIFORMS',
            enum: ['SCHOOL UNIFORMS']
        },
        subCategory: {
            type: String,
            required: true,
            trim: true,
            enum: ['REGULAR SCHOOL UNIFORMS', 'SPORTS UNIFORMS', 'WINTER UNIFORMS'],
        },
        gender: {
            type: String,
            required: true,
            trim: true,
            enum: ['GIRL', 'BOY'],
        },
        productType: {
            type: String,
            required: true,
            trim: true,
            enum: [
                'SHIRT', 'T-SHIRT', 'SKIRTS', 'TROUSER', 'WAISTCOAT', 'BLAZER', 'TRACK PANTS',
                'HOODIES', 'SWEATSHIRTS', 'JACKETS', 'PINAFORE', 'CULOTTES', 'PANTS', 'SHORTS', 'SWEATER'
            ],
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
            enum: ["22", "24", "26", "28", "30", "32", "34", "36", "38", "40", "42", "44"],
        },
        color: {
            type: String,
            required: true
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

togsSchema.index({ productId: 1 });

module.exports = mongoose.model("Togs", togsSchema);

