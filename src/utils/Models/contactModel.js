const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        match: [/.+\@.+\..+/, 'Please fill a valid email address']
    },
    mobile: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    organization: {
        type: String,
        default: null // Optional: Set default to null if not provided
    },
    date: {
        type: Date,
        default: Date.now // Automatically set to the current date and time
    }
}, { timestamps: true }); // Enable timestamps for createdAt and updatedAt

module.exports = mongoose.model("Contact", contactSchema);