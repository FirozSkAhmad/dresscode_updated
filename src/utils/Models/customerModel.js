const mongoose = require('mongoose');
const crypto = require('crypto'); 
const Schema = mongoose.Schema;

const customerSchema = new Schema({
    customerId: {
        type: String,
        trim: true,
        unique: true,
        default: () => {
            return crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 6);
        },
    },
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
