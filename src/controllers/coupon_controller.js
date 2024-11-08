const express = require('express');
const router = express.Router()
const jwt = require('jsonwebtoken');
const uuid = require('uuid');  // For unique coupon code generation
const Coupon = require('../utils/Models/couponModel');
const JwtHelper = require('../utils/Helpers/jwt_helper')
const jwtHelperObj = new JwtHelper();
const crypto = require('crypto');
const HealModel = require('../utils/Models/healModel');
const EliteModel = require('../utils/Models/eliteModel');
const TogsModel = require('../utils/Models/togsModel');

const modelMap = {
    "HEAL": HealModel,
    "ELITE": EliteModel,
    "TOGS": TogsModel,
};

const generateUniqueCouponCode = async () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let couponCode = '';
    let isUnique = false;

    while (!isUnique) {
        // Generate an 8-character coupon code
        couponCode = '';
        for (let i = 0; i < 8; i++) {
            couponCode += characters.charAt(Math.floor(Math.random() * characters.length));
        }

        // Check if the coupon code already exists in the database
        const existingCoupon = await Coupon.model('Coupon').findOne({ couponCode });
        if (!existingCoupon) {
            isUnique = true; // Set flag to true if code is unique
        }
    }

    return couponCode;
}

// API to verify JWT token and create coupon if permitted
router.post('/generate-token', async (req, res, next) => {
    try {
        // Payload containing the discount percentage
        const payload = req.body;

        // Options for JWT - set expiration and issuer
        const options = {
            expiresIn: '1d',  // Token expiration (1 day)
            issuer: 'trumsy'  // Issuer identifier
        };

        // Generate and return the JWT token

        const token = jwt.sign(payload, process.env.COUPON_SECRET_KEY, options);

        return res.status(201).json({ token })
    } catch (error) {
        throw new Error(`Error generating token: ${error.message}`);
    }
});


// API to verify JWT token and create a coupon if permitted
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

        // Extract values from the decoded token
        let { discountPercentage, group, styleCoat } = decoded;
        discountPercentage = parseFloat(discountPercentage); // Convert to number

        // Validate discountPercentage
        if (isNaN(discountPercentage) || discountPercentage <= 0 || discountPercentage > 100) {
            return res.status(400).json({ message: 'Invalid discount percentage in token' });
        }

        // Generate a unique coupon code
        const couponCode = await generateUniqueCouponCode();  // Custom unique code generation
        const expiryDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);  // 2-day expiration

        let linkedGroup = null;
        let linkedStyleCoat = null;

        // If group and styleCoat are provided, find and link the coupon to the specific product
        if (group && styleCoat) {
            const ProductModel = modelMap[group.trim().toUpperCase()];
            if (ProductModel) {
                // Find the product variant that matches the group and styleCoat
                const product = await ProductModel.findOne({ "variants.variantSizes.styleCoat": styleCoat });
                if (product) {
                    linkedGroup = group;
                    linkedStyleCoat = styleCoat; // Link the coupon to the specific group and styleCoat
                } else {
                    return res.status(404).json({ message: 'Product with specified group and styleCoat not found' });
                }
            } else {
                return res.status(400).json({ message: 'Invalid product group' });
            }
        }

        // Save the coupon in the database with linkage to the specific group and styleCoat if provided
        const newCoupon = new Coupon({
            couponCode,
            discountPercentage,
            status: 'pending',
            expiryDate,
            linkedGroup: linkedGroup || null, // Link the group if found, otherwise set to null
            linkedStyleCoat: linkedStyleCoat || null // Link the styleCoat if found, otherwise set to null
        });

        await newCoupon.save();

        res.status(201).json({
            message: 'Coupon generated successfully',
            couponCode,
            discountPercentage,
            linkedGroup,
            linkedStyleCoat
        });
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
            return res.status(400).json({ message: 'This coupon is already used.' });
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

