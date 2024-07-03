const express = require('express');
const OrderService = require('../services/order_service');
const Constants = require('../utils/Constants/response_messages')
const JwtHelper = require('../utils/Helpers/jwt_helper')
const jwtHelperObj = new JwtHelper();
const router = express.Router()

// POST endpoint to create an order
router.post('/createOrder/:userId', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const orderDetails = req.body;
        const { userId } = req.params

        const OrderServiceObj = new OrderService();
        const newOrder = await OrderServiceObj.createOrder(userId, orderDetails);

        res.status(201).send({
            message: "Order created successfully",
            order: newOrder
        });
    } catch (error) {
        console.error("Failed to create order:", error.message);
        res.status(500).send({ message: error.message });
    }
});

// POST endpoint to create an quote
router.post('/createQuote/:userId', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const orderDetails = req.body;
        const { userId } = req.params

        const OrderServiceObj = new OrderService();
        const newQuote = await OrderServiceObj.createQuote(userId, orderDetails);

        res.status(201).send({
            message: "Quote created successfully",
            quote: newQuote
        });
    } catch (error) {
        console.error("Failed to create order:", error.message);
        res.status(500).send({ message: error.message });
    }
});

module.exports = router;