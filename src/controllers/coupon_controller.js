const express = require('express');
const router = express.Router()
const jwt = require('jsonwebtoken');
const uuid = require('uuid');  // For unique coupon code generation
const Coupon = require('../utils/Models/couponModel');
const JwtHelper = require('../utils/Helpers/jwt_helper')
const jwtHelperObj = new JwtHelper();

// API to verify JWT token and create coupon if permitted
router.post('/request-coupon', async (req, res, next) => {
    if (!req.headers['authorization']) {
        return next(new global.DATA.PLUGINS.httperrors.Unauthorized("Please provide token"));
    }

    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader.split(' ');
    const token = bearerToken[1];

    try {
        // Verify JWT token and ensure it's issued by 'trumsy'
        const decoded = jwt.verify(token, process.env.COUPON_SECRET_KEY, { issuer: 'trumsy' });

        // Extract and convert discount percentage to a number
        let { discountPercentage } = decoded;
        discountPercentage = parseFloat(discountPercentage); // Convert to number

        // Validate discountPercentage
        if (isNaN(discountPercentage) || discountPercentage <= 0 || discountPercentage > 100) {
            return res.status(400).json({ message: 'Invalid discount percentage in token' });
        }

        // Generate unique coupon code and set expiration
        const couponCode = uuid.v4();  // Unique code generation
        const expiryDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);  // 2-day expiration

        // Save coupon in the database with status 'pending'
        const newCoupon = new Coupon({
            couponCode,
            discountPercentage,
            status: 'pending',
            expiryDate,
        });

        await newCoupon.save();

        res.status(201).json({ message: 'Coupon generated successfully', couponCode, discountPercentage });
    } catch (error) {
        console.error('Error generating coupon:', error);
        res.status(400).json({ message: 'Invalid token or request' });
    }
});

// API to get all coupons data
router.get('/all-coupons-data', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        // Extract the role type from the JWT token added to req by the middleware
        const roleType = req.aud.split(":")[1];
        if (!['WAREHOUSE MANAGER'].includes(roleType)) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only WAREHOUSE MANAGER can access coupons data."
            });
        }

        // Retrieve all coupons with specified fields
        const coupons = await Coupon.find({}, 'couponCode discountPercentage status expiryDate customerId orderId createdAt updatedAt');

        res.status(200).json({ coupons });
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).json({ message: 'Error retrieving coupons' });
    }
});

router.get('/check-coupon/:couponCode', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { couponCode } = req.params;

    try {
        // Check if the coupon exists in the database
        const coupon = await Coupon.findOne({ couponCode });

        // If coupon does not exist, send a 404 response
        if (!coupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }

        // Check if the coupon has expired
        const currentDate = new Date();
        if (coupon.expiryDate < currentDate) {
            return res.status(400).json({ message: 'Coupon has expired' });
        }

        // Check if the coupon is in 'pending' status and thus available for use
        if (coupon.status !== 'pending') {
            return res.status(400).json({ message: 'Coupon is not available for use' });
        }

        // Coupon is valid and can be used; respond with discount percentage
        res.status(200).json({
            message: 'Coupon is valid and available for use',
            couponCode,
            discountPercentage: coupon.discountPercentage
        });
    } catch (error) {
        console.error('Error checking coupon:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
