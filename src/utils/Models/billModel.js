const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the ProductVariantQuantity reference schema
const productVariantQuantitySchema = new mongoose.Schema({
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
        orderQuantity: {
            type: Number,
            required: true
        }
    }
    ]
});

// Define the EditRequestIds reference schema
const editRequestIdsSchema = new mongoose.Schema({
    editRequestId: {
        type: mongoose.Schema.Types.ObjectId, // Reference to EditRequest model
        required: true,
        ref: 'editRequest'
    }
});

const billSchema = new Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId, // Reference to Customer model
        required: true,
        ref: 'Customer'
    },
    products: [productVariantQuantitySchema],
    dateOfBill: {
        type: Date,
        default: Date.now
    },
    totalAmountOfOrder: {
        type: Number,
        required: true
    },
    isDeleted: {
        type: Boolean,
        required: true,
        default: false
    },
    dateOfDeletion: {
        type: Date,
        default: null
    },
    presentBillId: {
        type: mongoose.Schema.Types.ObjectId, // Reference to EditedBill model
        required: true,
        ref: 'EditedBill'
    },
    editStatus: {
        type: String,
        required: true,
        default: null,
        enum: ['PENDING', 'EDITED'],
    },
    editRequestIds: [editRequestIdsSchema]
}, {
    collection: 'bills', // Specifies the collection name in MongoDB
    timestamps: true // Automatically adds createdAt and updatedAt fields
});

module.exports = mongoose.model('Bill', billSchema);