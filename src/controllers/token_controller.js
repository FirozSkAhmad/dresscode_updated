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

    try {
        // Verify the Refresh Token
        const user = global.DATA.PLUGINS.jsonwebtoken.verify(refreshToken, process.env.REFRESH_TOKEN_SECRETKEY);
        
        // Create a token payload using the information from the decoded refresh token
        const tokenPayload = user.aud;

        // Generate a new Access Token
        const newAccessToken = await jwtHelperObj.generateAccessToken(tokenPayload);

        // Send new Access Token
        res.status(200).json({ accessToken: newAccessToken });
        
    } catch (err) {
        console.error('Invalid refresh token or exp:', err.message);
        res.status(403).json({ message: 'Invalid refresh token or exp' });
    }
});


module.exports = router;