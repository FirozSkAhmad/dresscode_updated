const admin = require("../firebase");
const UserModel = require('../utils/Models/userModel');
const express = require('express');
const router = express.Router()
const JwtHelper = require('../utils/Helpers/jwt_helper')
const jwtHelperObj = new JwtHelper();
const Constants = require('../utils/Constants/response_messages')

async function verifyToken(req, res, next) {
    const { loginType } = req.params;

    // Conditional logic based on loginType
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
            console.log(error.message);
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
            console.log(error.message);
            return res.status(401).send("Unauthorized");
        }
    }
}

router.post("/login/:loginType", verifyToken, async (req, res) => {
    const { uid, name, email, picture } = req.user;

    let user = await UserModel.findOne({
        $or: [
            { uid: uid },
            { email: email }
        ]
    });

    console.log(user)

    if (!user) {
        user = new UserModel({ uid, name, email });
        await user.save();
    }

    const tokenPayload = user._id + ":" + user.name;
    const accessToken = await jwtHelperObj.generateAccessToken(tokenPayload);

    const data = {
        accessToken: accessToken,
        userId: user._id,
        firstName: user.firstName
    };

    res.status(200).send({
        "message": Constants.SUCCESS,
        "data": data
    });
});

module.exports = router;