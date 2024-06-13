const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    user_name: {
        type: String,
        required: true,
        maxlength: 100
    },
    password: {
        type: String,
        required: true,
        maxlength: 200
    },
    email_id: {
        type: String,
        required: true,
        maxlength: 100
    },
    phn_no: {
        type: String,
        required: true,
        maxlength: 100
    },
    role_type: {
        type: String,
        enum: ['SUPER ADMIN','WAREHOUSE MANAGER','STORE MANAGER'],
        required: true
    },
    date_of_signUp: {
        type: String,
        maxlength: 100
    }
}, {
    collection: 'users', // Equivalent to tableName in Sequelize
    timestamps: true // Properly place timestamps configuration here
});

module.exports = mongoose.model('User', userSchema);

