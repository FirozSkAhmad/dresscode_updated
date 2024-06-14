const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const editRequestSchema = new Schema({
    billId: {
        type: mongoose.Schema.Types.ObjectId, // Reference to Bill model
        required: true,
        ref: 'Bill'
    },
    editedBillId: {
        type: mongoose.Schema.Types.ObjectId, // Reference to Bill model
        required: true,
        ref: 'Bill'
    },
    dateOfRequest: {
        type: Date,
        default: Date.now
    },
    dateOfValidation: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        required: true,
        default: 'PENDING',
        enum: ['PENDING','APPROVED','REJECTED'],
    }
}, {
    collection: 'editrequests', // Specifies the collection name in MongoDB
    timestamps: true // Automatically adds createdAt and updatedAt fields
});

module.exports = mongoose.model('EditRequest', editRequestSchema);