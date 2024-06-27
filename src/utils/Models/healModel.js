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
            "BLACK", "SAGE GREEN", "CHERRY LACQUER",
            "ELECTRIC INDIGO", "MAUVE", "CELESTIAL YELLOW",
            "DUSTED GRAPE", "SEPIA MIDNIGHT PLUM",
            "TERRACOTTA", "DIGITAL MIST", "COATS COLOR"
        ],
    },
    variantSizes: [{
        size: {
            type: String,
            required: true,
            trim: true,
            enum: ["XS", "S", "M", "L", "XL", "XXL"],
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
            name: {
                type: String,
                required: true,
                trim: true,
                default: 'HEAL'
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
                enum: ['COATS', 'SCRUBS'],
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
                enum: ['MEDICAL COATS', 'DOCTOR COATS', 'NURSE SCRUB SETS', 'REGULAR SCRUB SETS'],
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
            enum: ['UNISEX', 'MEN', 'WOMEN'],
        },
        productType: {
            type: {
                type: String,
                required: true,
                trim: true,
                enum: ['SHORT COATS', 'LONG COATS', 'TOP', 'PANT'],
            },
            imageUrl: {
                type: String,
                required: true
            }
        },
        fit: {
            type: String,
            required: true,
            trim: true,
            default: 'CLASSIC'
        },
        sleeves: {
            type: String,
            trim: true,
            enum: ["SHORT SLEEVES", "LONG SLEEVES"],
        },
        fabric: {
            type: String,
            required: true,
            trim: true,
            enum: ["POLY COTTON", "LAB COATS", "SPUN POLYESTER", "100% POLYESTER", ""],
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

healSchema.index({ productId: 1 });
healSchema.index({
    'group.name': 'text', 'category.name': 'text', 'subCategory.name': 'text',
    'gender': 'text', 'productType.type': 'text', 'fit': 'text',
    'sleeves': 'text', 'fabric': 'text', 'variants.color': 'text',
    'variants.color': 'text', 'variants.variantSizes.size': 'text'
});

module.exports = mongoose.model("Heals", healSchema);