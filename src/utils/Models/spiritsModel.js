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
    imgUrl: [String],
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
        default: "SPIRITS COLOR"
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
            enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
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
variantSchema.index({ color: 1 }); // Create an index on color

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
            name: {
                type: String,
                required: true,
                trim: true,
                default: 'SPIRIT'
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
                default: 'SPORTS WEAR',
                enum: ['SPORTS WEAR']
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
            enum: ['MEN', 'WOMEN', 'UNISEX']
        },
        productType: {
            type: {
                type: String,
                required: true,
                trim: true,
                enum: ['JACKETS', 'JERSEY T-SHIRT', 'TRACK PANT', 'SHORTS', 'JOGGERS']

            },
            imageUrl: {
                type: String,
                required: true
            }
        },
        neckline: {
            type: String,
            default: null,
            enum: ['POLO NECK', 'ROUND NECK'], // Only applicable to tops
        },
        sleeves: {
            type: String,
            default: null,
            enum: ['FULL SLEEVES', 'HALF SLEEVES', 'SLEEVELESS'], // Only applicable to tops
        },
        price: {
            type: Number,
            required: true,
            trim: true,
            default: null
        },
        productDeatails: {
            type: String,
            required: true,
            trim: true,
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

spiritSchema.index({ productId: 1 });

module.exports = mongoose.model("Spirit", spiritSchema);
