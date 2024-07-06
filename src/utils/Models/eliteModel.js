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
        enum: [
            "WHITE",
            "BLACK",
            "INDIGO",
            "SKY BLUE",
            "NAVY BLUE",
            "GREEN",
            "GREY",
            "MAROON",
            "RED",
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
variantSchema.index({ color: 1 }); // Create an index on color

const eliteSchema = new mongoose.Schema({
    productId: {
        type: String,
        trim: true,
        unique: true,
        default: () => {
            return crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 6);
        },
    },
    group: {
        name: {
            type: String,
            required: true,
            trim: true,
            default: "ELITE"
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
            default: "CORPORATE UNIFORMS",
            enum: ["CORPORATE UNIFORMS"]
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
            enum: ["ADMIN UNIFORMS", "RECEPTIONIST UNIFORMS", "CUSTOM UNIFORMS", "CUSTOM T-SHIRTS"]
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
        enum: ["MEN", "WOMEN"],
    },
    productType: {
        type: {
            type: String,
            required: true,
            trim: true,
            enum: ["SHIRT", "T-SHIRT", "SKIRT", "TROUSER", "WAISTCOAT", "BLAZER"],
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
        enum: ["CLASSIC", "SLIM"],
    },
    neckline: {
        type: String,
        required: true,
        trim: true,
        enum: ["SHIRT COLLAR", "MANDERIN COLLAR"],
    },
    sleeves: {
        type: String,
        required: true,
        trim: true,
        enum: ["SHORT SLEEVES", "LONG SLEEVES"],
    },
    price: {
        type: Number,
        required: true,
        trim: true,
        default: null
    },
    productDetails: {
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
}, { timestamps: true });

eliteSchema.pre('save', async function (next) {
    // Additional validation logic, e.g., custom business rules
    if (!this.group.name.startsWith('ELITE')) {
        throw new Error('Group must start with "ELITE"');
    }
    next();
});

eliteSchema.index({ productId: 1 });

module.exports = mongoose.model("Elite", eliteSchema);

