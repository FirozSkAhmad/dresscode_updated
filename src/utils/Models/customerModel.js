const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const customerSchema = new Schema({
    customerName: {
        type: String,
        required: true,
        maxlength: 100
    },
    customerPhone: {
        type: String,
        required: true,
        maxlength: 15 // Adjusted for typical phone number lengths
    },
    customerEmail: {
        type: String,
        required: true,
        maxlength: 100
    },
    isCreated: {
        type: Boolean,
        default: false
    }
}, {
    collection: 'customers', // Specifies the collection name in MongoDB
    timestamps: true // Automatically adds createdAt and updatedAt fields
});

customerSchema.index({ customerPhone: 1 });

module.exports = mongoose.model('Customer', customerSchema);
