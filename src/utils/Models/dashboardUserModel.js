const mongoose = require('mongoose');

const dashboardUserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'First name is required'],
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
    roleType: {
        type: String,
        required: true,
        trim: true,
        enum: ['WAREHOUSE MANAGER', 'SUPER ADMIN', 'STORE MANAGER'],
    },
    role: {
        type: String,
        required: true,
        trim: true,
        enum: ['SUPER ADMIN', 'PRODUCT MANAGER', 'CUSTOMER CARE', 'INVENTORY MANAGER'],
    }
});

module.exports = mongoose.model("DashboardUser", dashboardUserSchema);