const express = require('express');
const UploadedHistoryService = require('../services/uploadedHistory_service');
const Constants = require('../utils/Constants/response_messages')
const JwtHelper = require('../utils/Helpers/jwt_helper')
const jwtHelperObj = new JwtHelper();
const router = express.Router()


router.get('/getUploadedInvHistory', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    try {
        if (req.aud.split(":")[1] === "WAREHOUSE MANAGER") {
            const uploadedHistoryObj = new UploadedHistoryService();
            const result = await uploadedHistoryObj.getUploadedInvHistory();

            res.json(result);
        } else {
            res.status(401).send({
                "status": 401,
                "message": "Only Warehouse Manager have access to getUploadedInvHistory",
            });
        }
    } catch (err) {
        next(err);
    }
});

// Route to get detailed upload history for a specific upload ID
router.post('/getUploadHistoryById', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {

        if (req.aud.split(":")[1] === "WAREHOUSE MANAGER") {

            const { uploadId } = req.body; // Getting uploadId from the request body
            if (!uploadId) {
                return res.status(400).json({ status: 'error', message: 'Upload ID is required' });
            }
            
            const uploadedHistoryServiceObj = new UploadedHistoryService();
            const result = await uploadedHistoryServiceObj.getUploadHistoryById(uploadId);
            if (result.status === 'error') {
                return res.status(404).json(result);
            }

            res.json(result);
        } else {
            res.status(401).send({
                "status": 401,
                "message": "Only Warehouse Manager have access to getUploadedInvHistory",
            });
        }
    } catch (err) {
        next(err);
    }
});



module.exports = router;