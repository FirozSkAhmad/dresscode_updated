const express = require('express');
const InventoryService = require('../services/inventory_service');
const Constants = require('../utils/Constants/response_messages')
const JwtHelper = require('../utils/Helpers/jwt_helper')
const jwtHelperObj = new JwtHelper();
const router = express.Router()


router.post('/uploadInventory', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        const role_type = req.aud.split(":")[1]
        const user_name = req.aud.split(":")[2]
        if (["WAREHOUSE_MANAGER"].includes(role_type)) {
            const { category } = req.body;
            if (!category) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("required category")
            }
            const inventoryServiceObj = new InventoryService();
            const result = await inventoryServiceObj.uploadInventory(req.body);
            res.json(result);
        } else {
            res.status(401).json({
                "status": 401,
                "message": "Only Super Admin and Manager have access to upload the data.",
            });
        }
    } catch (err) {
        next(err);
    }
});


// Route to get all products
router.get('/getAllProducts', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const role_type = req.aud.split(":")[1]
        const user_name = req.aud.split(":")[2]
        if (["WAREHOUSE_MANAGER"].includes(role_type)) {
            const inventoryServiceObj = new InventoryService();
            const result = await inventoryServiceObj.getAllProducts(req.body);
            res.json(result);
        } else {
            res.status(401).json({
                "status": 401,
                "message": "Only Super Admin and Manager have access to upload the data.",
            });
        }

    } catch (err) {
        console.error('Failed to fetch products:', err);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve products', error: err.message });
    }
});

module.exports = router;