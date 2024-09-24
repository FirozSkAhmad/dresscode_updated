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
        name: {
            type: String,
            required: true
        },
        hexcode: {
            type: String,
            default: null
        }

    },
    variantSizes: [{
        size: {
            type: String,
            required: true,
            trim: true
        },
        quantity: {
            type: Number,
            required: true,
        },
        styleCoat: {
            type: String,
            trim: true,
            unique: true,
            default: () => {
                return crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 6);
            },
        },
        sku: {
            type: String,
            trim: true
        },
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
            trim: true
        },
        subCategory: {
            type: String,
            required: true,
            trim: true
        },
        schoolName: {
            type: String,
            required: true,
            trim: true
        },
        gender: {
            type: String,
            required: true,
            trim: true
        },
        productType: {
            type: String,
            required: true,
            trim: true
        },
        fit: {
            type: String,
            required: true,
            trim: true,
        },
        neckline: {
            type: String,
            required: true,
            trim: true,
        },
        pattern: {
            type: String,
            required: true,
            trim: true,
        },
        sleeves: {
            type: String,
            required: true,
            trim: true,
        },
        material: {
            type: String,
            required: true,
            trim: true,
        },
        price: {
            type: Number,
            required: true,
            trim: true,
            default: null
        },
        productDescription: {
            type: String,
            trim: true,
            default: null
        },
        sizeChart: {
            type: String,
            trim: true,
            default: null
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

