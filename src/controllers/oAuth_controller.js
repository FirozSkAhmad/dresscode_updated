const admin = require("../firebase");
const UserModel = require('../utils/Models/userModel');
const express = require('express');
const router = express.Router();
const JwtHelper = require('../utils/Helpers/jwt_helper');
const jwtHelperObj = new JwtHelper();
const Constants = require('../utils/Constants/response_messages');
const Coupon = require('../utils/Models/couponModel');
const global = require('../utils/global'); // Assuming global is imported from utils/global

async function verifyToken(req, res, next) {
    const { loginType } = req.params;

    if (loginType === "redirection") {
        if (!req.headers['authorization']) {
            return next(new global.DATA.PLUGINS.httperrors.Unauthorized("Please provide token"));
        }

        const token = req.headers.authorization;

        try {
            // Verify token using JWT for redirection
            const decoded = global.DATA.PLUGINS.jsonwebtoken.verify(token, process.env.COUPON_SECRET_KEY, { issuer: 'trumsy' });
            req.user = decoded; // Attach decoded user info to req
            next();
        } catch (error) {
            console.error("Token verification error:", error.message);
            return res.status(401).send("Unauthorized");
        }
    } else {
        const idToken = req.headers.authorization;

        if (!idToken) {
            return res.status(401).send("Unauthorized");
        }

        try {
            // Default Firebase token verification
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            req.user = decodedToken; // Attach decoded user info to req
            next();
        } catch (error) {
            console.error("Firebase token verification error:", error.message);
            return res.status(401).send("Unauthorized");
        }
    }
}

router.post("/login/:loginType", verifyToken, async (req, res) => {
    try {
        const { uid, name, email, picture, couponCode } = req.user;

        // Find or create the user by `uid` or `email`
        let user = await UserModel.findOne({
            $or: [
                { uid: uid },
                { email: email }
            ]
        });

        if (!user) {
            user = new UserModel({ uid, name, email });
            await user.save();
        } else if (!user.uid) {
            user.uid = uid;
            await user.save();
        }

        // Generate tokens
        const tokenPayload = `${user._id}:${user.name}`;
        const accessToken = await jwtHelperObj.generateAccessToken(tokenPayload);
        const refreshToken = await jwtHelperObj.generateRefreshToken(tokenPayload);

        // Set the refresh token in an HTTP-only cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            path: '/'
        });

        // Associate the provided coupon code with the user
        if (couponCode) {
            const coupon = await Coupon.findOne({ couponCode });

            if (coupon) {
                // Link the coupon to the user if not already linked
                if (!coupon.customerId) {
                    coupon.customerId = user._id;
                    await coupon.save();
                }

                // Add the coupon to the user's list of coupons if not already present
                if (!user.coupons.includes(coupon._id)) {
                    user.coupons.push(coupon._id);
                    await user.save();
                }
            } else {
                console.warn(`Coupon with code ${couponCode} not found`);
            }
        }

        // Prepare response data
        const data = {
            accessToken,
            userId: user._id,
            name: user.name,
            email: user.email,
        };

        return res.status(200).send({
            message: Constants.SUCCESS,
            data
        });
    } catch (error) {
        console.error("Error during login:", error.message);
        return res.status(500).send({
            message: "An error occurred during login",
            error: error.message
        });
    }
});

module.exports = router;
