const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the ProductVariantQuantity reference schema
const editedProductVariantQuantitySchema = new mongoose.Schema({
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

const editedbillSchema = new Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId, // Reference to Customer model
        required: true,
        ref: 'Customer'
    },
    products: [editedProductVariantQuantitySchema],
    dateOfBill: {
        type: Date,
        default: Date.now
    },
    totalAmountOfOrder: {
        type: Number,
        required: true
    },
    receivedNote: {
        type: String,
        required: true,
        maxlength: 100
    },
    senderNote: {
        type: String,
        required: true,
        maxlength: 100
    }
}, {
    collection: 'editedbills', // Specifies the collection name in MongoDB
    timestamps: true // Automatically adds createdAt and updatedAt fields
});

module.exports = mongoose.model('EditedBill', editedbillSchema);