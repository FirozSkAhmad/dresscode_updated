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



module.exports = router;