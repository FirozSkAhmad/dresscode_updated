const mongoose = require("mongoose");
const crypto = require('crypto');

const spiritSchema = new mongoose.Schema(
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
            default: 'SPIRIT'
        },
        category: {
            type: String,
            required: true,
            trim: true,
            default: 'SPORTS WEAR',
            enum: ['SPORTS WEAR']
        },
        gender: {
            type: String,
            required: true,
            trim: true,
            enum: ['MEN', 'WOMEN', 'UNISEX']
        },
        typeOfWare: {
            type: String,
            required: true,
            trim: true,
            enum: ['TOP', 'PANT']
        },
        productType: {
            type: String,
            required: true,
            trim: true,
            enum: ['JACKETS', 'JERSEY T-SHIRT', 'TRACK PANT', 'SHORTS', 'JOGGERS']
        },
        neckline: {
            type: String,
            enum: ['POLO NECK', 'ROUND NECK'], // Only applicable to tops
        },
        sleeves: {
            type: String,
            enum: ['FULL SLEEVES', 'HALF SLEEVES', 'SLEEVELESS'], // Only applicable to tops
        },
        size: {
            type: String,
            required: true,
            trim: true,
            enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        },
        color: {
            type: String,
            required: true,
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

spiritSchema.index({ productId: 1 });

module.exports = mongoose.model("Spirit", spiritSchema);
