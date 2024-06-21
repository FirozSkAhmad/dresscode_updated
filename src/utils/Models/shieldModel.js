const mongoose = require("mongoose");
const crypto = require('crypto'); // Use crypto module for random string generation


const shieldSchema = new mongoose.Schema(
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
            default: 'SHIELD'
        },
        category: {
            type: String,
            required: true,
            trim: true,
            enum: ['DEFENCE UNIFORM', 'SECURITY UNIFORM', 'POLICE UNIFORM'],
        },
        subCategory: {
            type: String,
            required: true,
            trim: true,
            enum: ['ARMY', 'NAVY', 'AIR FORCE', 'CRPF UNIFORM', 'SECURITY GUARD UNIFORM', 'TRAFFIC POLICE UNIFORM'],
        },
        gender: {
            type: String,
            required: true,
            trim: true,
            enum: ['MEN', 'WOMEN'],
        },
        productType: {
            type: String,
            required: true,
            trim: true,
            enum: ['SHIRT', 'BLAZER', 'TROUSER'],
        },
        fit: {
            type: String,
            required: true,
            trim: true,
            default: 'CLASSIC FITS'
        },
        size: {
            type: String,
            required: true,
            trim: true,
            enum: ["S", "M", "L", "XL", "XXL"],
        },
        color: {
            type: String,
            required: true,
            enum: [
                "OLIVE GREEN", "CAMOUFLAGE", "NAVY BLUE",
                "SKY BLUE", "BLACK", "WHITE"
            ]
        },
        fabric: {
            type: String,
            required: true,
            enum: [
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

shieldSchema.index({ productId: 1 });

module.exports = mongoose.model("Shields", shieldSchema);
