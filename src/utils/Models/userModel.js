const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema({
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
    }
});

const cartItemSchema = new mongoose.Schema({
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
    quantityRequired: { type: Number, required: true, min: 1 },
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
    checked: {
        type: Boolean,
        default: true
    }
});

const addressSchema = new mongoose.Schema({
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
    address: {
        type: String,
        required: [true, 'address name is required'],
        trim: true
    },
    city: {
        type: String,
        required: [true, 'city is required'],
        trim: true
    },
    pinCode: {
        type: String,
        required: [true, 'Pincode is required'],
        trim: true
    },
    state: {
        type: String,
        trim: true,
        required: [true, 'state is required'],
    },
    country: {
        type: String,
        required: [true, 'country is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'email is required'],
        trim: true
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        validate: {
            validator: function (v) {
                return /\d{10}/.test(v);
            },
            message: props => `${props.value} is not a valid phone number!`
        }
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
    uid: { type: String, default: null },
    name: {
        type: String,
        required: [true, 'Name is required'],
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
        enum: ['MALE', 'FEMALE', 'OTHER']
    },
    phoneNumber: {
        type: String,
        validate: {
            validator: function (v) {
                return /\d{10}/.test(v);
            },
            message: props => `${props.value} is not a valid phone number!`
        }
    },
    password: {
        type: String,
        minlength: 6
    },
    addresses: [addressSchema],
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    returnOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ReturnOrders' }],
    quotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quote' }],
    cart: [cartItemSchema],
    wishlist: [wishlistItemSchema],
    coupons: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon'
    }]
});

// Pre-save middleware to enforce conditional requirements
userSchema.pre('save', function (next) {
    if (!this.uid) {
        if (!this.gender) {
            this.invalidate('gender', 'Gender is required');
        }
        if (!this.phoneNumber) {
            this.invalidate('phoneNumber', 'Phone number is required');
        }
        if (!this.password) {
            this.invalidate('password', 'Password is required');
        }
    }
    next();
});

module.exports = mongoose.model("User", userSchema);



