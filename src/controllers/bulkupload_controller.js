const BulkUploadService = require('../services/bulkupload_service');
const multer = require('multer');
const router = require('express').Router();  // Ensure router is properly defined
const JwtHelper = require('../utils/Helpers/jwt_helper')
const jwtHelperObj = new JwtHelper();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const mongoose = require('mongoose');

// Function to verify if the uploaded file is a CSV
function isCsvFile(file) {
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    const mimeType = file.mimetype;
    return fileExtension === 'csv' && mimeType === 'text/csv';
}

router.post("/bulkUploadElites", jwtHelperObj.verifyAccessToken, upload.single('file'), async (req, res, next) => {
    const session = await mongoose.startSession();  // Start a session for the transaction
    session.startTransaction();  // Begin the transaction

    try {
        const roleType = req.aud.split(":")[1]; // Middleware decodes JWT and adds it to req
        if (roleType !== "WAREHOUSE MANAGER") {
            await session.abortTransaction();
            session.endSession();
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only Warehouse Manager can upload data."
            });
        }

        if (!req.file || !isCsvFile(req.file)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ status: 400, message: "Invalid file format. Please upload a CSV file." });
        }

        const bulkUploadServiceObj = new BulkUploadService();
        const result = await bulkUploadServiceObj.processCsvFile("ELITE", req.file.buffer, session); // Pass session to service methods
        await session.commitTransaction();
        session.endSession();
        res.json(result);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error while uploading the ELITE data:", err.message);
        next(err);
    }
});

router.post("/bulkUploadTogs", jwtHelperObj.verifyAccessToken, upload.single('file'), async (req, res, next) => {// jwtHelperObj.verifyAccessToken,
    const session = await mongoose.startSession();  // Start a session for the transaction
    session.startTransaction();  // Begin the transaction
    try {
        const roleType = req.aud.split(":")[1]; // Middleware decodes JWT and adds it to req
        if (roleType !== "WAREHOUSE MANAGER") {
            await session.abortTransaction();
            session.endSession();
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only Warehouse Manager can upload data."
            });
        }

        // Extract the schoolName from form-data
        const schoolName = req.body.schoolName;
        if (!schoolName) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                status: 400,
                message: "schoolName is required in the form-data."
            });
        }

        if (!req.file || !isCsvFile(req.file)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ status: 400, message: "Invalid file format. Please upload a CSV file." });
        }

        const bulkUploadServiceObj = new BulkUploadService();
        const result = await bulkUploadServiceObj.processCsvFile("TOGS", req.file.buffer, session, schoolName);
        await session.commitTransaction();
        session.endSession();
        res.json(result);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error while uploading the data:", err.message);
        next(err);
    }
});

router.post("/bulkUploadHeals", jwtHelperObj.verifyAccessToken, upload.single('file'), async (req, res, next) => {// jwtHelperObj.verifyAccessToken,
    const session = await mongoose.startSession();  // Start a session for the transaction
    session.startTransaction();  // Begin the transaction
    try {
        const roleType = req.aud.split(":")[1]; // Middleware decodes JWT and adds it to req
        if (roleType !== "WAREHOUSE MANAGER") {
            await session.abortTransaction();
            session.endSession();
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access. Only Warehouse Manager can upload data."
            });
        }

        if (!req.file || !isCsvFile(req.file)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ status: 400, message: "Invalid file format. Please upload a CSV file." });
        }

        const bulkUploadServiceObj = new BulkUploadService();
        const result = await bulkUploadServiceObj.processCsvFile("HEAL", req.file.buffer, session);
        await session.commitTransaction();
        session.endSession();
        res.json(result);
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error while uploading the data:", err.message);
        next(err);
    }
});

module.exports = router;
