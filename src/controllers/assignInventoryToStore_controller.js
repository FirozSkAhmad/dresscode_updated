const router = require('express').Router();
const jwtHelperObj = require('../utils/Helpers/jwt_helper'); // Ensure you have a similar helper for JWT
const AssignInventoryToStoreService = require('../services/assignInventoryToStore_service'); // Assuming you have a service for store operations
const Constants = require('../utils/Constants/response_messages'); // Assuming you have a constants file

// Route to assign products to a specific store
router.post('/assignProducts/:storeId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        // Additional authorization checks can be added here if needed
        if (req.aud.split(":")[1] === "WAREHOUSE MANAGER") {
            const { storeId } = req.params;
            const { productDetails } = req.body;
            const assignInventoryToStoreServiceObj = new AssignInventoryToStoreService();
            const result = await assignInventoryToStoreServiceObj.assignProductsToStore(storeId, productDetails);

            if (result.success) {
                res.json({
                    status: "success",
                    message: "Products assigned successfully",
                    data: result
                });
            } else {
                res.status(400).json({
                    status: "error",
                    message: "Failed to assign products",
                    details: result
                });
            }
        } else {
            res.status(401).json({
                status: "unauthorized",
                message: "Only Warehouse Managers have access to assign products"
            });
        }
    } catch (err) {
        console.error("Error assigning products to store:", err);
        next(err); // Pass errors to the error handling middleware
    }
});

// Route to get assigned history for a specific store
router.get('/assignedHistory/:storeId', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        if (req.aud.split(":")[1] === "WAREHOUSE MANAGER") {
            const { storeId } = req.params;
            const assignInventoryToStoreServiceObj = new AssignInventoryToStoreService();
            const result = await assignInventoryToStoreServiceObj.getAssignedHistoryByStore(storeId);

            if (result.success) {
                res.json({
                    status: "success",
                    message: "Assigned history retrieved successfully",
                    data: result.data
                });
            } else {
                res.status(404).json({
                    status: "error",
                    message: "No assigned history found for this store",
                    details: result.message
                });
            }
        } else {
            res.status(401).json({
                status: "unauthorized",
                message: "Only Warehouse Managers have access to view assigned history"
            });
        }
    } catch (err) {
        console.error("Error retrieving assigned history:", err);
        next(err); // Pass errors to the error handling middleware
    }
});

module.exports = router;