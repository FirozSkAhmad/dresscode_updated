const mongoose = require("mongoose");

// Define the ProductVariant reference schema
const productVariantSchema = new mongoose.Schema({
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
        quantityOfAssigned: {
            type: Number,
            required: true
        }
    }
    ]
});

// Define the Assigned History Schema
const assignedHistorySchema = new mongoose.Schema({
    assignedDate: {
        type: Date,
        default: Date.now
    },
    totalAmountOfAssigned: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        required: true,
        default: 'ASSIGNED',
        enum: ['ASSIGNED', 'RECEIVED']
    },
    productVariants: [productVariantSchema] // Array of product and their variants
});

module.exports = mongoose.model('AssignedHistory', assignedHistorySchema);

