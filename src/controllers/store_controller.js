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
const { parse } = require('json2csv');
const ExcelJS = require('exceljs');

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

// Controller for updating store
router.patch('/update-store/:storeId', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const roleType = req.aud.split(":")[1]; // Middleware decodes JWT and adds it to req
        if (roleType !== "WAREHOUSE MANAGER") {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only Warehouse Manager can update data."
            });
        }

        const { storeId } = req.params;
        const updateFields = req.body; // Only send the fields to be updated

        // Ensure at least one field is provided for update
        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ message: "No fields provided for update." });
        }

        // Call the service layer to update the store
        const serviceResponse = await storeServiceObj.updateStore(storeId, updateFields);

        // Check the service response
        if (!serviceResponse.success) {
            return res.status(serviceResponse.statusCode).send({
                message: serviceResponse.message
            });
        }

        res.status(serviceResponse.statusCode).send({
            message: 'Store updated successfully',
            store: serviceResponse.store
        });
    } catch (error) {
        console.error('Error updating store:', error.message);
        res.status(500).send({ error: error.message });
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
        const result = await storeServiceObj.getAssignedInventoriesByStore(storeId);
        res.json({
            "message": "assigned inventories retrived successfully",
            "assignedInventories": result
        });
    } catch (err) {
        console.error("Error while retrieving assigned inventories:", err.message);
        next(err);
    }
});

router.get('/assigned-inventories', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (!['WAREHOUSE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER can access assigned inventories."
            });
        }

        // Process the request and get store details
        const result = await storeServiceObj.getAssignedInventories();
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
        const result = await storeServiceObj.downloadInventory(storeId, res);
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
        if (roleType !== "STORE MANAGER") {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only STORE MANAGER can raise inventory request."
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

router.get('/raised-inventory-requests-by-store/:storeId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
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
                message: "Unauthorized access. Only WAREHOUSE MANAGER AND STORE MANAGER can access raised inventory requests."
            });
        }

        // Process the request and get store details
        const result = await storeServiceObj.getRaisedInventoryRequestsByStore(storeId);
        res.json(result);
    } catch (err) {
        console.error("Error while retrieving raised inventory requests:", err.message);
        next(err);
    }
});

router.get('/raised-inventory-requests', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {

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
        res.json({
            message: "Successfully retrieved raised inventory requests",
            raisedInventoryReqs: result
        });
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

router.patch('/reject-inventory-request/:raisedInventoryId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
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
                message: "Unauthorized access. Only WAREHOUSE MANAGER can reject inventory request."
            });
        }

        const result = await storeServiceObj.rejectInventory(raisedInventoryId, roleType);
        res.json(result);
    } catch (err) {
        console.error("Error while rejecting inventory request:", err.message);
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
        if (!['STORE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only STORE MANAGER can approve inventory request."
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

router.post('/create-bill/:storeId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        const { storeId } = req.params;
        const billData = req.body

        // Validate that storeId is provided
        if (!storeId) {
            return res.status(400).json({
                status: 400,
                message: "Store ID is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (roleType !== "STORE MANAGER") {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only STORE MANAGER can create bill."
            });
        }

        const result = await storeServiceObj.createBill(storeId, billData);
        res.json(result);
    } catch (err) {
        console.error("Error while creating bill:", err.message);
        next(err);
    }
});

router.patch('/create-bill-delete-req', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        const { storeId, billId } = req.query;
        const { RequestedBillDeleteNote } = req.body;

        // Validate that storeId is provided
        if (!storeId) {
            return res.status(400).json({
                status: 400,
                message: "Store ID is required."
            });
        }

        // Validate that storeId is provided
        if (!billId) {
            return res.status(400).json({
                status: 400,
                message: "Bill ID is required."
            });
        }

        if (!RequestedBillDeleteNote) {
            return res.status(400).json({
                status: 400,
                message: "Requested Bill Delete Note is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (roleType !== "STORE MANAGER") {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only STORE MANAGER can delete bill."
            });
        }

        const result = await storeServiceObj.createBillDeleteReq(storeId, billId, RequestedBillDeleteNote);
        res.json(result);
    } catch (err) {
        console.error("Error while deleting bill:", err.message);
        next(err);
    }
});

router.patch('/validate-bill-delete-req', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {

        const { storeId, billId, isApproved } = req.query;
        const { ValidatedBillDeleteNote } = req.body;

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (!['WAREHOUSE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER can retrieve bill details."
            });
        }

        const result = await storeServiceObj.validateBillDeleteReq(storeId, billId, isApproved, ValidatedBillDeleteNote);
        res.json(result);
    } catch (err) {
        console.error("Error while Validating Bill delete Req:", err.message);
        next(err);
    }
});

router.get('/get-deleted-bills/:storeId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
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
        if (roleType !== "STORE MANAGER") {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only STORE MANAGER can get deleted bills."
            });
        }

        const result = await storeServiceObj.getDeletedBillsByStoreId(storeId);
        res.json({
            message: 'Deleted bills fetched successfully',
            deletedBills: result
        });
    } catch (err) {
        console.error("Error while retrieving deleted bills:", err.message);
        next(err);
    }
});

router.get('/get-all-deleted-bills', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (roleType !== 'WAREHOUSE MANAGER') {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER can retrieve all deleted bills."
            });
        }

        const result = await storeServiceObj.getDeletedBills();
        res.json({
            message: 'Bills fetched successfully',
            deletedBills: result
        });
    } catch (err) {
        console.error("Error while retrieving bills:", err.message);
        next(err);
    }
});

router.get('/get-bills', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (roleType !== "WAREHOUSE MANAGER") {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER can get all bills."
            });
        }

        const result = await storeServiceObj.getBills();
        res.json({
            message: 'Bills fetched successfully',
            Bills: result
        });
    } catch (err) {
        console.error("Error while retrieving all bills:", err.message);
        next(err);
    }
});

router.get('/get-bills/:storeId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
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
        if (!['WAREHOUSE MANAGER', "STORE MANAGER"].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only STORE MANAGER and WAREHOUSE MANAGER can get bills."
            });
        }

        const result = await storeServiceObj.getBillsByStoreId(storeId);
        res.json({
            message: 'bills fetched successfully',
            Bills: result
        });
    } catch (err) {
        console.error("Error while retrieving bills:", err.message);
        next(err);
    }
});

router.get('/get-bill-details/:billId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {

        const { billId } = req.params;
        // Validate that storeId is provided
        if (!billId) {
            return res.status(400).json({
                status: 400,
                message: "Bill ID is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (!['WAREHOUSE MANAGER', 'STORE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER and STORE MANAGER can retrieve bill details."
            });
        }

        const result = await storeServiceObj.getBillDetailsByBillId(billId);
        res.json({
            message: 'Bill details fetched successfully',
            result
        });
    } catch (err) {
        console.error("Error while retrieving bill details:", err.message);
        next(err);
    }
});

router.get('/get-customer-details/:customerPhone', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        const { customerPhone } = req.params;

        // Validate that storeId is provided
        if (!customerPhone) {
            return res.status(400).json({
                status: 400,
                message: "customerPhone is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (!['WAREHOUSE MANAGER', 'STORE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER AND STORE MANAGER can access customer details."
            });
        }

        const result = await storeServiceObj.getCustomerByPhone(customerPhone);
        res.json({
            message: "Retrived the customer details successfully.",
            result
        });
    } catch (err) {
        console.error("Error while assigning inventory:", err.message);
        next(err);
    }
});

router.post('/create-customer', async (req, res, next) => {
    try {
        const customerDetails = req.body

        const result = await storeServiceObj.createCustomer(customerDetails);
        res.json(result);
    } catch (err) {
        console.error("Error while creating customer:", err.message);
        next(err);
    }
});

router.post('/create-bill-edit-req', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        const { storeId, billId } = req.query;
        const billEditReqData = req.body

        // Validate that storeId is provided
        if (!storeId) {
            return res.status(400).json({
                status: 400,
                message: "Store ID is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (roleType !== "STORE MANAGER") {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only STORE MANAGER can create bill edit req."
            });
        }

        const result = await storeServiceObj.createBillEditReq(billId, storeId, billEditReqData);
        res.json(result);
    } catch (err) {
        console.error("Error while creating bill edit req:", err.message);
        next(err);
    }
});

router.get('/get-bill-edit-reqs/:storeId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
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
        if (roleType !== "STORE MANAGER") {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only STORE MANAGER can get bill edit reqs."
            });
        }

        const result = await storeServiceObj.getBillEditReqsByStoreId(storeId);
        res.json({
            message: 'bill edit reqs fetched successfully',
            Bills: result
        });
    } catch (err) {
        console.error("Error while retrieving bill edit reqs:", err.message);
        next(err);
    }
});

router.get('/get-bill-edit-reqs', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (roleType !== "WAREHOUSE MANAGER") {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER can get bill edit reqs."
            });
        }

        const result = await storeServiceObj.getBillEditReqs();
        res.json({
            message: 'bill edit reqs fetched successfully',
            Bills: result
        });
    } catch (err) {
        console.error("Error while retrieving bill edit reqs:", err.message);
        next(err);
    }
});

router.get('/get-bill-edit-req-details/:editBillReqId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {

        const { editBillReqId } = req.params;
        // Validate that storeId is provided
        if (!editBillReqId) {
            return res.status(400).json({
                status: 400,
                message: "Edit Bill Req ID is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (!['WAREHOUSE MANAGER', 'STORE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER and STORE MANAGER can retrieve bill details."
            });
        }

        const result = await storeServiceObj.getBillEditReqDetails(editBillReqId);
        res.json({
            message: 'Bill Edit Req details fetched successfully',
            result
        });
    } catch (err) {
        console.error("Error while retrieving bill details:", err.message);
        next(err);
    }
});


router.get('/download-bill-edit-reqs', async (req, res, next) => {
    try {

        // const { isApproved } = req.query//true, false, pending

        // Fetch all bill edit requests with detailed information
        const billEditRequests = await storeServiceObj.getDetailedBillEditReqs();//isApproved

        // Create a new workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Bill Edit Requests');

        // Define columns with widths
        worksheet.columns = [
            { header: 'Edit Bill Req ID', key: 'editBillReqId', width: 20 },
            { header: 'Store ID', key: 'storeId', width: 20 },
            { header: 'Is Approved', key: 'isApproved', width: 15 },
            { header: 'Date of Validation', key: 'dateOfValidate', width: 20 },
            { header: 'Date of Bill Edit Req', key: 'dateOfBillEditReq', width: 25 },
            { header: 'Date of Bill', key: 'dateOfBill', width: 20 },
            { header: 'Req Note', key: 'reqNote', width: 25 },
            { header: 'Validate Note', key: 'validateNote', width: 25 },
            { header: 'Invoice URL', key: 'invoiceUrl', width: 30 },
            { header: 'Approved Invoice URL', key: 'approvedInvoiceUrl', width: 30 },
            { header: 'Customer ID', key: 'customerId', width: 25 },
            { header: 'B.Customer Name', key: 'billedCustomerName', width: 25 },
            { header: 'B.Customer Phone', key: 'billedCustomerPhone', width: 20 },
            { header: 'B.Customer Email', key: 'billedCustomerEmail', width: 30 },
            { header: 'R.Customer Name', key: 'requestedCustomerName', width: 25 },
            { header: 'R.Customer Phone', key: 'requestedCustomerPhone', width: 20 },
            { header: 'R.Customer Email', key: 'requestedCustomerEmail', width: 30 },
            { header: 'B.Product ID', key: 'billedProductId', width: 20 },
            { header: 'R.Product ID', key: 'requestedProductId', width: 20 },
            { header: 'B.Variant ID', key: 'billedVariantId', width: 20 },
            { header: 'R.Variant ID', key: 'requestedVariantId', width: 20 },
            { header: 'B.Variant Color', key: 'billedVariantColor', width: 15 },
            { header: 'R.Variant Color', key: 'requestedVariantColor', width: 15 },
            { header: 'B.Variant Size', key: 'billedVariantSize', width: 15 },
            { header: 'R.Variant Size', key: 'requestedVariantSize', width: 15 },
            { header: 'B.Variant Billed Quantity', key: 'billedQuantity', width: 15 },
            { header: 'R.Variant Billed Quantity', key: 'requestedBilledQuantity', width: 15 },
            { header: 'B.Total Amount', key: 'billedTotalAmount', width: 15 },
            { header: 'R.Total Amount', key: 'requestedTotalAmount', width: 15 },
            { header: 'B.Discount Percentage', key: 'billedDiscountPercentage', width: 20 },
            { header: 'R.Discount Percentage', key: 'requestedDiscountPercentage', width: 20 },
            { header: 'B.Price After Discount', key: 'billedPriceAfterDiscount', width: 20 },
            { header: 'R.Price After Discount', key: 'requestedPriceAfterDiscount', width: 20 },
        ];

        billEditRequests.forEach(request => {
            const billedCustomer = request.currentBill?.customer || {};
            const requestedBillCustomer = request.requestedBillEdit?.customer || {};
            const billedProducts = request.currentBill?.products || [];
            const requestedProducts = request.requestedBillEdit?.products || [];

            // Ensure both arrays have the same length for comparison
            const maxProducts = Math.max(billedProducts.length, requestedProducts.length);

            for (let i = 0; i < maxProducts; i++) {
                const billedProduct = billedProducts[i] || {}; // Default to an empty object if no product exists
                const requestedProduct = requestedProducts[i] || {}; // Default to an empty object if no product exists

                const billedVariant = billedProduct.variants?.[0] || {};
                const requestedVariant = requestedProduct.variants?.[0] || {};

                worksheet.addRow({
                    editBillReqId: i === 0 ? request.requestedBillEdit.editBillReqId : '', // Blank for subsequent rows
                    storeId: i === 0 ? request.requestedBillEdit.storeId || 'N/A' : '',
                    isApproved: i === 0 ? request.requestedBillEdit.isApproved === null ? 'PENDING' : request.requestedBillEdit.isApproved : '',
                    dateOfValidate: i === 0 ? request.requestedBillEdit.dateOfValidate === null ? '--' : request.requestedBillEdit.dateOfValidate : '',
                    dateOfBillEditReq: i === 0 ? request.requestedBillEdit.dateOfBillEditReq : '',
                    dateOfBill: i === 0 ? request.requestedBillEdit.dateOfBill : '',
                    reqNote: i === 0 ? request.requestedBillEdit.reqNote || 'N/A' : '',
                    validateNote: i === 0 ? request.requestedBillEdit.validateNote || 'N/A' : '',
                    invoiceUrl: i === 0 ? request.currentBill.invoiceUrl || 'N/A' : '',
                    approvedInvoiceUrl: i === 0 ? request.requestedBillEdit.approvedInvoiceUrl || 'N/A' : '',
                    customerId: i === 0 ? billedCustomer.customerId || 'N/A' : '',
                    billedCustomerName: i === 0 ? billedCustomer.customerName || 'N/A' : '',
                    requestedCustomerName: i === 0
                        ? billedCustomer.customerName === requestedBillCustomer.customerName
                            ? '-'
                            : requestedBillCustomer.customerName || 'N/A'
                        : '',
                    billedCustomerPhone: i === 0 ? billedCustomer.customerPhone || 'N/A' : '',
                    requestedCustomerPhone: i === 0
                        ? billedCustomer.customerPhone === requestedBillCustomer.customerPhone
                            ? '-'
                            : requestedBillCustomer.customerPhone || 'N/A'
                        : '',
                    billedCustomerEmail: i === 0 ? billedCustomer.customerEmail || 'N/A' : '',
                    requestedCustomerEmail: i === 0
                        ? billedCustomer.customerEmail === requestedBillCustomer.customerEmail
                            ? '-'
                            : requestedBillCustomer.customerEmail || 'N/A'
                        : '',
                    billedProductId: billedProduct.productId || 'N/A',
                    requestedProductId: billedProduct.productId === requestedProduct.productId
                        ? '-'
                        : requestedProduct.productId || 'N/A',
                    billedVariantId: billedVariant.variantId || 'N/A',
                    requestedVariantId: billedVariant.variantId === requestedVariant.variantId
                        ? '-'
                        : requestedVariant.variantId || 'N/A',
                    billedVariantColor: billedVariant.color?.name || 'N/A',
                    requestedVariantColor: billedVariant.color?.name === requestedVariant.color?.name
                        ? '-'
                        : requestedVariant.color?.name || 'N/A',
                    billedVariantSize: billedVariant.variantSizes?.[0]?.size || 'N/A',
                    requestedVariantSize: billedVariant.variantSizes?.[0]?.size === requestedVariant.variantSizes?.[0]?.size
                        ? '-'
                        : requestedVariant.variantSizes?.[0]?.size || 'N/A',
                    billedQuantity: billedVariant.variantSizes?.[0]?.billedQuantity || 'N/A',
                    requestedBilledQuantity: billedVariant.variantSizes?.[0]?.billedQuantity === requestedVariant.variantSizes?.[0]?.billedQuantity
                        ? '-'
                        : requestedVariant.variantSizes?.[0]?.billedQuantity || 'N/A',
                    billedTotalAmount: i === 0 ? request.currentBill.TotalAmount || 'N/A' : '',
                    requestedTotalAmount: i === 0
                        ? request.currentBill.TotalAmount === request.requestedBillEdit.TotalAmount
                            ? '-'
                            : request.requestedBillEdit.TotalAmount || 'N/A'
                        : '',
                    billedDiscountPercentage: i === 0 ? request.currentBill.discountPercentage || 'N/A' : '',
                    requestedDiscountPercentage: i === 0
                        ? request.currentBill.discountPercentage === request.requestedBillEdit.discountPercentage
                            ? '-'
                            : request.requestedBillEdit.discountPercentage || 'N/A'
                        : '',
                    billedPriceAfterDiscount: i === 0 ? request.currentBill.priceAfterDiscount || 'N/A' : '',
                    requestedPriceAfterDiscount: i === 0
                        ? request.currentBill.priceAfterDiscount === request.requestedBillEdit.priceAfterDiscount
                            ? '-'
                            : request.requestedBillEdit.priceAfterDiscount || 'N/A'
                        : '',
                });
            }
        });

        // Set headers for the file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="bill_edit_requests.xlsx"');

        // Write the Excel file to the response
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error("Error while generating Excel for bill edit reqs:", err.message);
        next(err);
    }
});



router.patch('/validate-bill-edit-req', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {

        const { editBillReqId, isApproved } = req.query;
        const { validateNote } = req.body;
        // Validate that storeId is provided
        if (!editBillReqId) {
            return res.status(400).json({
                status: 400,
                message: "Edit Bill Req ID is required."
            });
        }

        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (!['WAREHOUSE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER can retrieve bill details."
            });
        }

        const result = await storeServiceObj.validateBillEditReq(editBillReqId, isApproved, validateNote);
        res.json({
            message: 'Validated Bill Edit Req successfully',
            result
        });
    } catch (err) {
        console.error("Error while Validating Bill Edit Req:", err.message);
        next(err);
    }
});

router.get('/get-store-overview/:storeId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
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
                message: "Unauthorized access. Only WAREHOUSE MANAGER and STORE MANAGER can retrieve store overview."
            });
        }

        const result = await storeServiceObj.getStoreOverview(storeId);
        res.json({
            message: 'store overview fetched successfully',
            result
        });
    } catch (err) {
        console.error("Error while retrieving store overview:", err.message);
        next(err);
    }
});

module.exports = router;
