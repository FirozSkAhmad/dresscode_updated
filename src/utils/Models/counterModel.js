const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const counterSchema = new Schema({
    _id: {type: String, required: true},
    seq: { type: Number, default: 1000 }  // Starting point for your IDs
});

module.exports = mongoose.model('Counter', counterSchema);
