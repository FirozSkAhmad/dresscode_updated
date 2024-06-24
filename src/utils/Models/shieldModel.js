const mongoose = require("mongoose");
const crypto = require('crypto'); // Use crypto module for random string generation

const reviewSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        default: null
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        default: null
    },
    comment: {
        type: String,
        required: true,
        default: null
    },
}, { timestamps: true });

const variantSchema = new mongoose.Schema({
    color: {
        type: String,
        required: true,
        enum: [
            "OLIVE GREEN", "CAMOUFLAGE", "NAVY BLUE",
            "SKY BLUE", "BLACK", "WHITE"
        ],
    },
    variantSizes: [{
        size: {
            type: String,
            required: true,
            trim: true,
            enum: ["S", "M", "L", "XL", "XXL"],
        },
        quantity: {
            type: Number,
            required: true,
            default: 100,
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
        unique: true, // Ensure unique variantId for each variant
        default: () => {
            // Generate a random 6 character alphanumeric string with a prefix (optional)
            const prefix = "VAR-"; // You can customize the prefix here
            return `${prefix}${crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 6)}`;
        },
    },
});

// Indexing the variantId
variantSchema.index({ variantId: 1 }); // Create an index on variantId

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
            name: {
                type: String,
                required: true,
                trim: true,
                default: 'SHIELD'
            },
            imageUrl: {
                type: String,
                required: true
            }
        },
        category: {
            name: {
                type: String,
                required: true,
                trim: true,
                enum: ['DEFENCE UNIFORM', 'SECURITY UNIFORM', 'POLICE UNIFORM'],
            },
            imageUrl: {
                type: String,
                required: true
            }
        },
        subCategory: {
            name: {
                type: String,
                required: true,
                trim: true,
                enum: ['ARMY', 'NAVY', 'AIR FORCE', 'CRPF UNIFORM', 'SECURITY GUARD UNIFORM', 'TRAFFIC POLICE UNIFORM'],
            },
            imageUrl: {
                type: String,
                required: true
            }
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
        fabric: {
            type: String,
            required: true,
            enum: [
                "POLY COTTON"
            ]
        },
        variants: [variantSchema],
        isDeleted: {
            type: Boolean,
            required: true,
            default: false,
        },
        reviews: [reviewSchema]
    },
    {
        timestamps: true,
    }
);

shieldSchema.index({ productId: 1 });

module.exports = mongoose.model("Shields", shieldSchema);
