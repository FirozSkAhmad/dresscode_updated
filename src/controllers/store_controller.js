const express = require('express');
const Constants = require('../utils/Constants/response_messages')
const JwtHelper = require('../utils/Helpers/jwt_helper')
const jwtHelperObj = new JwtHelper();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const router = express.Router()
const { startSession } = require('mongoose');
const StoreService = require('../services/store_service');
const storeServiceObj = new StoreService();

// Create Store Controller
router.post('/create-store', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const storeData = req.body;
        // Validate request data
        const validationErrors = validateStoreData(storeData);
        if (validationErrors.length > 0) {
            return res.status(400).json({ errors: validationErrors });
        }

        // Call the service layer to create the store
        const newStore = await storeServiceObj.createStore(storeData);
        res.status(201).json({ message: 'Store created successfully', store: newStore });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Validate Store Data Function
const validateStoreData = (data) => {
    const errors = [];

    if (!data.storeName || typeof data.storeName !== 'string') errors.push('Store Name is required and must be a string.');
    if (!data.storeAddress || typeof data.storeAddress !== 'string') errors.push('Store Address is required and must be a string.');
    if (!data.city || typeof data.city !== 'string') errors.push('City is required and must be a string.');
    if (!data.pincode || typeof data.pincode !== 'string') errors.push('Pincode is required and must be a string.');
    if (!data.state || typeof data.state !== 'string') errors.push('State is required and must be a string.');
    if (typeof data.commissionPercentage !== 'number' || data.commissionPercentage < 0 || data.commissionPercentage > 100) {
        errors.push('Commission Percentage must be a number between 0 and 100.');
    }
    if (!data.userName || typeof data.userName !== 'string') errors.push('User Name is required and must be a string.');
    if (!data.phoneNo || !/^\d{10}$/.test(data.phoneNo)) errors.push('Phone No is required and must be a valid 10-digit number.');
    if (!data.emailID || !/^\S+@\S+\.\S+$/.test(data.emailID)) errors.push('Email ID is required and must be a valid email address.');
    if (!data.password || typeof data.password !== 'string') errors.push('Password is required and must be a string.');

    return errors;
};