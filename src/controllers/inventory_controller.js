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
        if (["WAREHOUSE MANAGER"].includes(role_type)) {
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

router.post('/uploadHealProduct', async (req, res, next) => {//jwtHelperObj.verifyAccessToken
    try {
        // const role_type = req.aud.split(":")[1]
        // const user_name = req.aud.split(":")[2]
        // if (["WAREHOUSE_MANAGER"].includes(role_type)) {
            const inventoryServiceObj = new InventoryService();
            const result = await inventoryServiceObj.uploadHealProduct(req.body);
            res.json(result);
        // } else {
        //     res.status(401).json({
        //         "status": 401,
        //         "message": "Only Super Admin and Manager have access to upload the data.",
        //     });
        // }
    } catch (err) {
        next(err);
    }
});

router.post('/uploadShieldProduct', async (req, res, next) => {//jwtHelperObj.verifyAccessToken
    try {
        // const role_type = req.aud.split(":")[1]
        // const user_name = req.aud.split(":")[2]
        // if (["WAREHOUSE_MANAGER"].includes(role_type)) {
            const inventoryServiceObj = new InventoryService();
            const result = await inventoryServiceObj.uploadShieldProduct(req.body);
            res.json(result);
        // } else {
        //     res.status(401).json({
        //         "status": 401,
        //         "message": "Only Super Admin and Manager have access to upload the data.",
        //     });
        // }
    } catch (err) {
        next(err);
    }
});

router.post('/uploadEliteProduct', async (req, res, next) => {//jwtHelperObj.verifyAccessToken
    try {
        // const role_type = req.aud.split(":")[1]
        // const user_name = req.aud.split(":")[2]
        // if (["WAREHOUSE_MANAGER"].includes(role_type)) {
            const inventoryServiceObj = new InventoryService();
            const result = await inventoryServiceObj.uploadEliteProduct(req.body);
            res.json(result);
        // } else {
        //     res.status(401).json({
        //         "status": 401,
        //         "message": "Only Super Admin and Manager have access to upload the data.",
        //     });
        // }
    } catch (err) {
        next(err);
    }
});

router.post('/uploadTogsProduct', async (req, res, next) => {//jwtHelperObj.verifyAccessToken
    try {
        // const role_type = req.aud.split(":")[1]
        // const user_name = req.aud.split(":")[2]
        // if (["WAREHOUSE_MANAGER"].includes(role_type)) {
            const inventoryServiceObj = new InventoryService();
            const result = await inventoryServiceObj.uploadTogsProduct(req.body);
            res.json(result);
        // } else {
        //     res.status(401).json({
        //         "status": 401,
        //         "message": "Only Super Admin and Manager have access to upload the data.",
        //     });
        // }
    } catch (err) {
        next(err);
    }
});

router.post('/uploadSpiritProduct', async (req, res, next) => {//jwtHelperObj.verifyAccessToken
    try {
        // const role_type = req.aud.split(":")[1]
        // const user_name = req.aud.split(":")[2]
        // if (["WAREHOUSE_MANAGER"].includes(role_type)) {
            const inventoryServiceObj = new InventoryService();
            const result = await inventoryServiceObj.uploadSpiritProduct(req.body);
            res.json(result);
        // } else {
        //     res.status(401).json({
        //         "status": 401,
        //         "message": "Only Super Admin and Manager have access to upload the data.",
        //     });
        // }
    } catch (err) {
        next(err);
    }
});

router.post('/uploadWorkWearProduct', async (req, res, next) => {//jwtHelperObj.verifyAccessToken
    try {
        // const role_type = req.aud.split(":")[1]
        // const user_name = req.aud.split(":")[2]
        // if (["WAREHOUSE_MANAGER"].includes(role_type)) {
            const inventoryServiceObj = new InventoryService();
            const result = await inventoryServiceObj.uploadWorkWearProduct(req.body);
            res.json(result);
        // } else {
        //     res.status(401).json({
        //         "status": 401,
        //         "message": "Only Super Admin and Manager have access to upload the data.",
        //     });
        // }
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