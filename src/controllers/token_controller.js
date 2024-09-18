const express = require('express');
const JwtHelper = require('../utils/Helpers/jwt_helper')
const jwtHelperObj = new JwtHelper();
const router = express.Router()

router.post('/generateAccessToken', async (req, res, next) => {
    // Get Refresh Token from HTTP-only cookie
    const refreshToken = req.cookies['refreshToken'];

    if (!refreshToken) {
        return res.status(401).json({ message: 'No refresh token provided' });
    }

    // Verify the Refresh Token
    global.DATA.PLUGINS.jsonwebtoken.verify(refreshToken, process.env.REFRESH_TOKEN_SECRETKEY, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid refresh token' });
        }

        console.log(user)

        // Generate a new Access Token
        const newAccessToken = global.DATA.PLUGINS.jsonwebtoken.sign({  }, process.env.ACCESS_TOKEN_SECRETKEY, { expiresIn: '1hr' });

        // Send new Access Token
        res.status(200).json({ accessToken: newAccessToken });
    });
});

module.exports = router;