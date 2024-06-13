const mongoose = require("mongoose");
const AssignedHistory = require("./assignedHistoryModel");
const Counter = require("./counterModel");

const variantSchema = new mongoose.Schema({
    size: {
        type: String,
        required: true,
        enum: ["S", "M", "L", "XL", "XXL"],
    },
    color: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    images: {
        type: [String], // Array of image URLs
        required: true,
    },
});

const reviewSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
    comment: {
        type: String,
        required: true,
    },
}, { timestamps: true });

const productSchema = new mongoose.Schema(
    {
        productId: { type: Number, index: { unique: true } },
        category: {
            type: String,
            required: true,
            trim: true,
        },
        schoolName: {
            type: String,
            required: false,
            trim: true,
        },
        productCategory: {
            type: String,
            required: true,
            trim: true,
        },
        productName: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        gender: {
            type: String,
            required: true,
            enum: ["MALE", "FEMALE", "UNISEX"],
        },
        pattern: {
            type: String,
            required: false,
        },
        prodId: {
            type: String,
            required: true,
            trim: true,
        },
        variants: [variantSchema],
        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
        },
        reviews: [reviewSchema]
    },
    {
        timestamps: true,
    }
);

// Pre-save middleware to auto-increment productId
productSchema.pre('save', async function (next) {
    if (this.isNew) {
        try {
            const counter = await Counter.findByIdAndUpdate(
                { _id: 'productId' },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            this.productId = counter.seq; // Ensure field name matches
            next();
        } catch (error) {
            next(error); // Pass the error to the next middleware
        }
    } else {
        next();
    }
});

// Additional index setup remains unchanged
productSchema.index({ productId: 1 });
productSchema.index({ category: 1 });
productSchema.index({ school_name: 1 });
productSchema.index({ product_category: 1 });
productSchema.index({ product_name: 1 });
productSchema.index({ gender: 1 });
productSchema.index({ pattern: 1 });
productSchema.index({ prodId: 1 });

module.exports = mongoose.model("Product", productSchema);