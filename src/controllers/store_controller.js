const express = require('express');
const Constants = require('../utils/Constants/response_messages')
const JwtHelper = require('../utils/Helpers/jwt_helper')
const jwtHelperObj = new JwtHelper();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const router = express.Router()
const { startSession } = require('mongoose');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const StoreService = require('../services/store_service');
const storeServiceObj = new StoreService();

// Function to verify if the uploaded file is a CSV
function isCsvFile(file) {
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    const mimeType = file.mimetype;
    return fileExtension === 'csv' && mimeType === 'text/csv';
}

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
        const StoreNameAndIds = await storeServiceObj.getAllStoreNameAndIds();
        res.status(200).json({ message: "store name and Ids retrived successfully", StoreNameAndIds });
    } catch (err) {
        console.error("Error while get store names:", err.message);
        next(err);
    }
});


router.post('/assign-inventory/:storeId', jwtHelperObj.verifyAccessToken, upload.single('file'), async (req, res, next) => {
    try {
        const { storeId } = req.params;

        // Validate that storeId is provided
        if (!storeId) {
            return res.status(400).json({
                status: 400,
                message: "Store ID is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (roleType !== "WAREHOUSE MANAGER") {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only Warehouse Managers can assign inventory to stores."
            });
        }

        // Validate the uploaded file
        if (!req.file || !isCsvFile(req.file)) {
            return res.status(400).json({
                status: 400,
                message: "Invalid file format. Please upload a CSV file."
            });
        }

        // Process the CSV file and assign inventory
        const result = await storeServiceObj.processCsvFile(req.file.buffer, storeId);
        res.json(result);
    } catch (err) {
        console.error("Error while assigning inventory:", err.message);
        next(err);
    }
});

router.patch('/receive-inventory/:assignedInventoryId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        const { assignedInventoryId } = req.params;

        if (!assignedInventoryId) {
            return res.status(400).json({
                status: 400,
                message: "assignedInventoryId is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (!['STORE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only Store Manager can receive inventory to stores."
            });
        }

        const userStoreId = req.aud.split(":")[0];

        const result = await storeServiceObj.receiveInventory(assignedInventoryId, roleType, userStoreId);
        res.json(result);
    } catch (err) {
        console.error("Error while assigning inventory:", err.message);
        next(err);
    }
});

router.get('/get-storeDetails/:storeId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        const { storeId } = req.params;

        // Validate that storeId is provided
        if (!storeId) {
            return res.status(400).json({
                status: 400,
                message: "storeId is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (!['WAREHOUSE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER can access store details."
            });
        }

        // Process the request and get store details
        const result = await storeServiceObj.getStoreDetails(storeId, roleType);
        res.json(result);
    } catch (err) {
        console.error("Error while retrieving store details:", err.message);
        next(err);
    }
});

router.get('/assigned-inventories/:storeId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {

        const { storeId } = req.params;

        // Validate that storeId is provided
        if (!storeId) {
            return res.status(400).json({
                status: 400,
                message: "storeId is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (!['STORE MANAGER', 'WAREHOUSE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER AND STORE MANAGER can access assigned inventories."
            });
        }

        // Process the request and get store details
        const result = await storeServiceObj.getAssignedInventories(storeId);
        res.json({
            "message": "assigned inventories retrived successfully",
            "assignedInventories": result
        });
    } catch (err) {
        console.error("Error while retrieving assigned inventories:", err.message);
        next(err);
    }
});

router.get('/assigned-inventory-details/:assignedInventoryId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        const { assignedInventoryId } = req.params;

        // Validate that storeId is provided
        if (!assignedInventoryId) {
            return res.status(400).json({
                status: 400,
                message: "assignedInventoryId is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (!['WAREHOUSE MANAGER', 'STORE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER AND STORE MANAGER can access assigned inventory details."
            });
        }

        const result = await storeServiceObj.getAssignedInventoryDetails(assignedInventoryId);
        res.json(result);
    } catch (err) {
        console.error("Error while assigning inventory:", err.message);
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

router.get('/downloadInventory/:storeId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {

        const { storeId } = req.params;

        // Validate that storeId is provided
        if (!storeId) {
            return res.status(400).json({
                status: 400,
                message: "storeId is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (!['STORE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only STORE MANAGER can download the store inventory."
            });
        }

        const userStoreId = req.aud.split(":")[0];
        // If the user is a STORE MANAGER, ensure they are associated with the correct store
        if (roleType === 'STORE MANAGER' && storeId !== userStoreId) {
            throw new Error("Forbidden. You are not authorized to download the store inventory.");
        }

        // Process the request and get store details
        const result = await storeServiceObj.downloadInventory(storeId);
        res.json(result);
    } catch (err) {
        console.error("Error while retrieving store details:", err.message);
        next(err);
    }
});

router.post('/raise-inventory-request', jwtHelperObj.verifyAccessToken, upload.single('file'), async (req, res, next) => {
    try {
        const { storeId, storeName } = req.body;

        // Validate that storeId is provided
        if (!storeId) {
            return res.status(400).json({
                status: 400,
                message: "Store ID is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (roleType !== "WAREHOUSE MANAGER") {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only Warehouse Managers can assign inventory to stores."
            });
        }

        // Validate the uploaded file
        if (!req.file || !isCsvFile(req.file)) {
            return res.status(400).json({
                status: 400,
                message: "Invalid file format. Please upload a CSV file."
            });
        }

        // Process the CSV file and assign inventory
        const result = await storeServiceObj.processCsvFile(req.file.buffer, storeId, storeName, "RAISE");
        res.json(result);
    } catch (err) {
        console.error("Error while rasing inventory request:", err.message);
        next(err);
    }
});

router.get('/raised-inventory-requests', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {

        // Validate that storeId is provided
        if (!storeId) {
            return res.status(400).json({
                status: 400,
                message: "storeId is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (!['STORE MANAGER', 'WAREHOUSE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER AND STORE MANAGER can access raised inventory requests."
            });
        }

        // Process the request and get store details
        const result = await storeServiceObj.getRaisedInventoryRequests();
        res.json(result);
    } catch (err) {
        console.error("Error while retrieving raised inventory requests:", err.message);
        next(err);
    }
});

router.get('/raised-inventory-details/:raisedInventoryId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        const { raisedInventoryId } = req.params;

        // Validate that storeId is provided
        if (!raisedInventoryId) {
            return res.status(400).json({
                status: 400,
                message: "raisedInventoryId is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (!['WAREHOUSE MANAGER', 'STORE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER AND STORE MANAGER can access raised inventory details."
            });
        }

        const result = await storeServiceObj.getRaisedInventoryDetails(raisedInventoryId, roleType);
        res.json(result);
    } catch (err) {
        console.error("Error while assigning inventory:", err.message);
        next(err);
    }
});

router.patch('/approve-inventory-request/:raisedInventoryId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        const { raisedInventoryId } = req.params;

        // Validate that storeId is provided
        if (!raisedInventoryId) {
            return res.status(400).json({
                status: 400,
                message: "raisedInventoryId is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (!['WAREHOUSE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER can approve inventory request."
            });
        }

        const result = await storeServiceObj.approveInventory(raisedInventoryId, roleType);
        res.json(result);
    } catch (err) {
        console.error("Error while assigning inventory:", err.message);
        next(err);
    }
});

router.patch('/approve-inventory-request/:raisedInventoryId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        const { raisedInventoryId } = req.params;

        // Validate that storeId is provided
        if (!raisedInventoryId) {
            return res.status(400).json({
                status: 400,
                message: "raisedInventoryId is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (!['WAREHOUSE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER can approve inventory request."
            });
        }

        const result = await storeServiceObj.approveInventory(raisedInventoryId, roleType);
        res.json(result);
    } catch (err) {
        console.error("Error while assigning inventory:", err.message);
        next(err);
    }
});

router.patch('/receive-inventory-request/:raisedInventoryId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        const { raisedInventoryId } = req.params;

        // Validate that storeId is provided
        if (!raisedInventoryId) {
            return res.status(400).json({
                status: 400,
                message: "raisedInventoryId is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (!['WAREHOUSE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER can approve inventory request."
            });
        }

        const userStoreId = req.aud.split(":")[0];

        const result = await storeServiceObj.receiveInventoryReq(raisedInventoryId, roleType, userStoreId);
        res.json(result);
    } catch (err) {
        console.error("Error while assigning inventory:", err.message);
        next(err);
    }
});


router.get('/get-products/:storeId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        const { storeId } = req.params;

        // Validate that storeId is provided
        if (!storeId) {
            return res.status(400).json({
                status: 400,
                message: "storeId is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (!['WAREHOUSE MANAGER', 'STORE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER AND STORE MANAGER can access raised inventory details."
            });
        }

        const result = await storeServiceObj.getproducts(storeId);
        res.json(result);
    } catch (err) {
        console.error("Error while assigning inventory:", err.message);
        next(err);
    }
});

module.exports = router;