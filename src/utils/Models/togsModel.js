const mongoose = require("mongoose");
const crypto = require('crypto');

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
        default: "TOGS COLOR"
        // enum: [
        //     "WHITE",
        //     "BLACK",
        //     "INDIGO",
        //     "SKY BLUE",
        //     "NAVY BLUE",
        //     "GREEN",
        //     "GREY",
        //     "MAROON",
        //     "RED",
        // ],
    },
    variantSizes: [{
        size: {
            type: String,
            required: true,
            trim: true,
            enum: ["22", "24", "26", "28", "30", "32", "34", "36", "38", "40", "42", "44"],
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
            name: {
                type: String,
                required: true,
                trim: true,
                default: 'TOGS'
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
                default: 'SCHOOL UNIFORMS',
                enum: ['SCHOOL UNIFORMS']
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
                enum: ['REGULAR SCHOOL UNIFORMS', 'SPORTS UNIFORMS', 'WINTER UNIFORMS'],
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
            enum: ['GIRL', 'BOY'],
        },
        productType: {
            type: {
                type: String,
                required: true,
                trim: true,
                enum: [
                    'SHIRT', 'T-SHIRT', 'SKIRTS', 'TROUSER', 'WAISTCOAT', 'BLAZER', 'TRACK PANTS',
                    'HOODIES', 'SWEATSHIRTS', 'JACKETS', 'PINAFORE', 'CULOTTES', 'PANTS', 'SHORTS', 'SWEATER'
                ],
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

togsSchema.index({ productId: 1 });

module.exports = mongoose.model("Togs", togsSchema);

