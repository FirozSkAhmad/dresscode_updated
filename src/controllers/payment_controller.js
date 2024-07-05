const express = require('express');
const Constants = require('../utils/Constants/response_messages');
const crypto = require('crypto');
const JwtHelper = require('../utils/Helpers/jwt_helper');
const PaymentModel = require('../utils/Models/paymentModel.js');
const jwtHelperObj = new JwtHelper();
const router = express.Router();
const Razorpay = require('razorpay')

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET,
});

router.post('/checkout', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        const options = {
            amount: Number(req.body.amount * 100),
            currency: "INR",
        };
        const order = await instance.orders.create(options);

        res.status(200).json({
            success: true,
            order,
        });
    } catch (err) {
        next(err);
    }
});



router.post('/verifyPayment', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const body = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_API_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            // Assuming Payment model exists and has a create method
            const payment = await PaymentModel.create({
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
            });

            res.status(200).json({
                success: true,
                message: Constants.SUCCESS,
                paymentId: payment._id, // Include the ID of the newly created payment
            });
        } else {
            res.status(400).json({
                success: false,
                message: Constants.FAILURE,
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message || Constants.ERROR,
        });
    }
});

module.exports = router;
