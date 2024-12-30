const mongoose = require('mongoose');
const crypto = require('crypto');

const addressSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    contactPhone: {
        type: String,
        required: [true, 'Contact phone number is required'],
        trim: true,
        validate: {
            validator: function (v) {
                return /\d{10}/.test(v); // Assuming a 10-digit number, adjust regex as necessary for local formats
            },
            message: props => `${props.value} is not a valid phone number!`
        }
    },
    email: {
        type: String,
        required: [true, 'E-mail is required'],
        trim: true,
        lowercase: true,
        validate: {
            validator: function (v) {
                return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
            },
            message: props => `${props.value} is not a valid email address!`
        }
    },
    organizationName: {
        type: String,
        trim: true,
        default: null  // Optional field
    },
    street: {
        type: String,
        required: [true, 'Street is required'],
        trim: true
    },
    lane: {
        type: String,
        required: [true, 'Lane is required'],
        trim: true
    },
    postalCode: {
        type: String,
        required: [true, 'Postal code is required'],
        trim: true,
        validate: {
            validator: function (v) {
                return /\d+/.test(v); // Basic digit check, adapt regex to match local postal code formats
            },
            message: props => `${props.value} is not a valid postal code!`
        }
    }
});

const quoteSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    quoteId: {
        type: String,
        trim: true,
        unique: true,
        default: () => {
            // Generate a random 6 character alphanumeric string
            return crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
        },
    },
    group: { type: String, required: true, trim: true },
    productId: { type: String, required: true, trim: true },
    color: {
        name: {
            type: String,
            required: true,
            trim: true
        },
        hexcode: {
            type: String,
            trim: true
        }
    },
    size: { type: String, required: true, trim: true },
    quantityRequired: { type: Number, required: true, min: 35 },
    imgUrl: {
        type: String, trim: true, default: null
    },
    logoUrl: {
        type: String, trim: true, default: null
    },
    name: {
        type: String, trim: true, default: null
    },
    logoPosition: {
        type: String, trim: true, default: null
    },
    dateOfQuoteRecived: {
        type: Date, default: Date.now
    },
    address: addressSchema
});

quoteSchema.index({ quoteId: 1 })

module.exports = mongoose.model("Quote", quoteSchema);