const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the ProductVariant reference schema
const productVariantsSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId, // Reference to Product model
        required: true,
        ref: 'Product'
    },
    variantIdsQunatity: [{
        variantId: {
            type: mongoose.Schema.Types.ObjectId, // Reference to Variant subdocuments in Product model
            ref: 'Variant' // Make sure you define a Variant model if it's referenced directly, or adjust according to your schema
        },
        quantity: {
            type: Number,
            required: true
        }
    }
    ]
});

// Define the ProductVariant reference schema
const assignedIdsSchema = new mongoose.Schema({
    assignedId: {
        type: mongoose.Schema.Types.ObjectId, // Reference to Product model
        required: true,
        ref: 'AssignedHistory'
    }
});

const storeSchema = new Schema({
    storeName: {
        type: String,
        required: true,
        maxlength: 100
    },
    storeType: {
        type: String,
        required: true,
        enum: ["SCHOOL"],
    },
    storeAddress: {
        type: String,
        required: true,
        maxlength: 200
    },
    city: {
        type: String,
        required: true,
        maxlength: 50
    },
    pincode: {
        type: String,
        required: true,
        maxlength: 10
    },
    state: {
        type: String,
        required: true,
        maxlength: 50
    },
    commissionPersentage: {
        type: Number,
        required: false,
        min: 0,
        max: 100 // Assuming this is a percentage
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    productVariants: [productVariantsSchema],
    assignedIds: [assignedIdsSchema] //arrary of assignedIds to a particular store
}, {
    timestamps: true,
    collection: 'stores'
});

// Indexes for optimized querying
storeSchema.index({ storeName: 1 });


module.exports = mongoose.model('Store', storeSchema);
