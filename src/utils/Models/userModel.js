const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema({
    group: { type: String, required: true, trim: true },
    productId: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true },
    size: { type: String, required: true, trim: true },
});

const cartItemSchema = new mongoose.Schema({
    group: { type: String, required: true, trim: true },
    productId: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true },
    size: { type: String, required: true, trim: true },
    quantityRequired: { type: Number, required: true, min: 1 },
});

const addressSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    mobile: {
        type: String,
        required: [true, 'Mobile number is required'],
        validate: {
            validator: function (v) {
                return /\d{10}/.test(v);
            },
            message: props => `${props.value} is not a valid phone number!`
        }
    },
    flatNumber: {
        type: String,
        required: [true, 'Flat number/Building name is required'],
        trim: true
    },
    locality: {
        type: String,
        required: [true, 'Locality/Area/Street is required'],
        trim: true
    },
    pinCode: {
        type: String,
        required: [true, 'Pin code is required'],
        trim: true
    },
    landmark: {
        type: String,
        trim: true
    },
    districtCity: {
        type: String,
        required: [true, 'District/City is required'],
        trim: true
    },
    state: {
        type: String,
        required: [true, 'State is required'],
        trim: true
    },
    addressType: {
        type: String,
        enum: ['Home', 'Work', 'Others'],
        required: [true, 'Address type is required']
    },
    markAsDefault: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
});

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email address is required'],
        trim: true,
        unique: true,
        lowercase: true,
        validate: {
            validator: function (v) {
                return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
            },
            message: props => `${props.value} is not a valid email address!`
        }
    },
    gender: {
        type: String,
        required: [true, 'Gender is required'],
        enum: ['MALE', 'FEMALE', 'OTHER']
    },
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        validate: {
            validator: function (v) {
                return /\d{10}/.test(v);
            },
            message: props => `${props.value} is not a valid phone number!`
        }
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6
    },
    addresses: [addressSchema],
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    quotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quote' }],
    cart: [cartItemSchema], // Adding the cart as an array of cartItemSchema
    wishlist: [wishlistItemSchema]
});

module.exports = mongoose.model("User", userSchema);



