const router = require('express').Router();
const jwtHelperObj = require('../utils/Helpers/jwt_helper'); // Ensure you have a similar helper for JWT
const StoreService = require('../services/storeCreation_service'); // Assuming you have a service for store operations
const Constants = require('../utils/Constants/response_messages'); // Assuming you have a constants file

// POST request to create a new store
router.post('/createStore', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        // Check if the authenticated user is a WAREHOUSE MANAGER
        if (req.aud.split(":")[1] === "WAREHOUSE MANAGER") {
            const storeServiceObj = new StoreService();
            const storeData = req.body; // Data for the new store from the request body

            const data = await storeServiceObj.createStore(storeData); // Method to handle store creation

            res.send({
                "status": 200,
                "message": Constants.SUCCESS,
                "data": data
            });
        } else {
            res.status(401).send({
                "status": 401,
                "message": "Only Warehouse Managers have access to create stores",
            });
        }
    } catch (err) {
        next(err); // Pass errors to the error handling middleware
    }
});

// Route to get store names and their IDs
router.get('/getStoreNamesAndIds', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {

        if (req.aud.split(":")[1] === "WAREHOUSE MANAGER") {
            const storeServiceObj = new StoreService();
            const result = await storeServiceObj.getStoreNamesAndIds();
            if (result.status === 'error') {
                return res.status(500).json(result);
            }

            res.json(result);
        } else {
            res.status(401).send({
                "status": 401,
                "message": "Only Warehouse Managers have access to getStoreNamesAndIds",
            });
        }
    } catch (err) {
        next(err); // Pass errors to the error handling middleware
    }
});

router.get('/getStoreDetails/:storeId', async (req, res) => {
    try {
        if (req.aud.split(":")[1] === "WAREHOUSE MANAGER") {

            const { storeId } = req.params;
            const storeServiceObj = new StoreService();
            const result = await storeServiceObj.getStoreDetails(storeId);

            res.json(result);
        } else {
            res.status(401).send({
                "status": 401,
                "message": "Only Warehouse Managers have access to getStoreDetails",
            });
        }
    } catch (err) {
        next(err); // Pass errors to the error handling middleware
    }
});

// Route to get inventory details by store ID
router.get('/getStoreInventory/:storeId', async (req, res) => {
    try {
        if (req.aud.split(":")[1] === "WAREHOUSE MANAGER") {

            const { storeId } = req.params;
            const storeServiceObj = new StoreService();
            const result = await storeServiceObj.getStoreInventory(storeId);
            if (result.status === 'error') {
                return res.status(404).json(result);
            }

            res.json(result);
        } else {
            res.status(401).send({
                "status": 401,
                "message": "Only Warehouse Managers have access to getStoreDetails",
            });
        }
    } catch (err) {
        next(err); // Pass errors to the error handling middleware
    }
});

module.exports = router;
