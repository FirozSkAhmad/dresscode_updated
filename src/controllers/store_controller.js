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

        const roleType = req.aud.split(":")[1]; // Middleware decodes JWT and adds it to req
        if (roleType !== "WAREHOUSE MANAGER") {
            await session.abortTransaction();
            session.endSession();
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only Warehouse Manager can upload data."
            });
        }

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

// Define the route to get all store names
router.get('/store-names', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const roleType = req.aud.split(":")[1]; // Middleware decodes JWT and adds it to req
        if (roleType !== "WAREHOUSE MANAGER") {
            await session.abortTransaction();
            session.endSession();
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only Warehouse Manager can upload data."
            });
        }
        const storeNames = await storeServiceObj.getAllStoreNames();
        res.status(200).json(storeNames);
    } catch (err) {
        console.error("Error while get store names:", err.message);
        next(err);
    }
});

router.post('/store-login', async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const data = await storeServiceObj.loginUser(req.body, session, res);
        await session.commitTransaction();
        res.send({
            "status": 200,
            "message": Constants.SUCCESS,
            "data": data
        });
    } catch (err) {
        await session.abortTransaction();
        console.error("Transaction aborted due to an error:", err.message);
        next(err);
    } finally {
        session.endSession();
    }
});


module.exports = router;