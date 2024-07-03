const express = require('express');
const UserService = require('../services/user_service');
const Constants = require('../utils/Constants/response_messages')
const JwtHelper = require('../utils/Helpers/jwt_helper')
const jwtHelperObj = new JwtHelper();
const router = express.Router()


router.post('/createUser', async (req, res, next) => {
    try {
        const adminServiceObj = new UserService();
        await adminServiceObj.createUser(req.body);
        res.send({
            "status": 200,
            "message": Constants.SUCCESS,
        });
    } catch (err) {
        next(err);
    }
});

router.post('/login', async (req, res, next) => {
    try {
        const userSeviceObj = new UserService();
        const data = await userSeviceObj.loginUser(req.body);
        res.send({
            "status": 200,
            "message": Constants.SUCCESS,
            "data": data
        })
    }
    catch (err) {
        next(err);
    }
})

router.patch('/:userId/updateUserDetails', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {

        const { userId } = req.params

        const userServiceObj = new UserService();
        const updates = req.body;

        // Call the updateUserDetails method from the UserService
        const updatedUserData = await userServiceObj.updateUserDetails(userId, updates);

        res.status(200).send({
            status: 200,
            message: Constants.SUCCESS,
            data: updatedUserData
        });
    } catch (err) {
        // Forward error handling to your error-handling middleware
        next(err);
    }
});

router.post('/:userId/addAddress', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const newAddress = req.body;
        const userServiceObj = new UserService();
        const addresses = await userServiceObj.addAddress(userId, newAddress);
        res.status(200).send({ message: "Address added successfully", data: addresses });
    } catch (error) {
        console.error("Failed to add address:", error.message);
        res.status(500).send({ message: error.message });
    }
});

router.patch('/:userId/updateAddress/:addressId', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const { userId, addressId } = req.params;
        const addressUpdates = req.body;

        const userServiceObj = new UserService();
        const updatedAddress = await userServiceObj.updateAddress(userId, addressId, addressUpdates);

        res.status(200).send({
            message: "Address updated successfully",
            data: updatedAddress
        });
    } catch (error) {
        console.error("Failed to update address:", error.message);
        res.status(500).send({ message: error.message });
    }
});

router.patch('/:userId/address/:addressId/setToDefault', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const { userId, addressId } = req.params;

        const userServiceObj = new UserService();
        const result = await userServiceObj.setDefaultAddress(userId, addressId);

        res.status(200).send({
            message: result.message
        });
    } catch (error) {
        console.error("Failed to set default address:", error.message);
        res.status(500).send({ message: error.message });
    }
});

router.patch('/:userId/address/:addressId/removeAddress', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const { userId, addressId } = req.params;

        const userServiceObj = new UserService();
        const result = await userServiceObj.deleteAddress(userId, addressId);

        res.status(200).send({
            message: result.message
        });
    } catch (error) {
        console.error("Failed to mark address as deleted:", error.message);
        res.status(500).send({ message: error.message });
    }
});

router.get('/:userId/addresses/active', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const { userId } = req.params;

        const userServiceObj = new UserService();
        const addresses = await userServiceObj.getActiveAddresses(userId);

        res.status(200).send({
            message: "Active addresses retrieved successfully",
            data: addresses
        });
    } catch (error) {
        console.error("Failed to retrieve active addresses:", error.message);
        res.status(500).send({ message: error.message });
    }
});

router.get('/:userId/getOrders',jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const userServiceObj = new UserService();
        const orders = await userServiceObj.getUserOrdersWithProductDetails(userId);

        if (orders.length === 0) {
            return res.status(404).send({ message: 'No orders found for this user.' });
        }

        res.status(200).send({
            message: "Orders retrieved successfully",
            orders: orders
        });
    } catch (error) {
        console.error("Failed to retrieve orders:", error.message);
        res.status(500).send({ message: error.message });
    }
});

module.exports = router;