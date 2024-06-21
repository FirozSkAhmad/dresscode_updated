const mongoose = require("mongoose");
const crypto = require('crypto'); // Use crypto module for random string generation

const healScrubsSchema = new mongoose.Schema(
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
            default: 'SCRUBS',
            enum: ['SCRUBS']
        },
        subCategory: {
            type: String,
            required: true,
            trim: true,
            enum: ['NURSE SCRUB SETS', 'REGULAR SCRUB SETS'],
        },
        gender: {
            type: String,
            required: true,
            trim: true,
            enum: ['MEN', 'WOMEN'],
        },
        typeOfWare: {
            type: String,
            required: true,
            trim: true,
            enum: ['TOP', 'PANT'],
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
        color: {
            type: String,
            required: true,
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
            enum: [
                "SPUN POLYESTER",
                "100% POLYESTER",
                "POLY COTTON"
            ]
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

healScrubsSchema.index({ productId: 1 });

module.exports = mongoose.model("HealScrubs", healScrubsSchema);