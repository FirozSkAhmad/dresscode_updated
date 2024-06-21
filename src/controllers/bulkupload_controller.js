// const express = require('express');
// const router = express.Router();
// const JwtHelper = require('../utils/Helpers/jwt_helper');
// const jwtHelperObj = new JwtHelper();
// const BulkUploadService = require('../services/bulkupload_service');
// const multer = require('multer');
// const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });

// // Function to verify if the uploaded file is a CSV
// function isCsvFile(file) {
//     const fileExtension = file.originalname.split('.').pop().toLowerCase();
//     const mimeType = file.mimetype;
//     return fileExtension === 'csv' && mimeType === 'text/csv';
// }

// router.post("/bulkUpload", jwtHelperObj.verifyAccessToken, upload.single('file'), async (req, res, next) => {
//     try {
//         const role_type = req.aud.split(":")[1]
//         const user_name = req.aud.split(":")[2]
//         if (["WAREHOUSE_MANAGER"].includes(role_type)) {
//             if (!req.file || !isCsvFile(req.file)) {
//                 return res.status(400).json({ "status": 400, "message": "Invalid file format. Please upload a CSV file." });
//             }

//             const { category } = req.body;
//             if (!category) {
//                 throw new global.DATA.PLUGINS.httperrors.BadRequest("required category")
//             }
//             const storeType = "WARE_HOUSE"
//             const storeId = null
//             const bulkUploadServiceObj = new BulkUploadService();
//             const result = await bulkUploadServiceObj.processCsvFile(req.file.buffer, category.toUpperCase(), storeType, storeId);
//             res.json(result);
//         } else {
//             res.status(401).json({
//                 "status": 401,
//                 "message": "Only Super Admin and Manager have access to upload the data.",
//             });
//         }
//     } catch (err) {
//         console.error("Error while uploading the projects:", err.message);
//         next(err);
//     }
// });

const BulkUploadService = require('../services/bulkupload_service');
const multer = require('multer');
const router = require('express').Router();  // Ensure router is properly defined
// const jwtHelperObj = require('../middleware/jwtHelper'); // Make sure JWT helper is correctly imported

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Function to verify if the uploaded file is a CSV
function isCsvFile(file) {
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    const mimeType = file.mimetype;
    return fileExtension === 'csv' && mimeType === 'text/csv';
}

router.post("/bulkUploadElite", upload.single('file'), async (req, res, next) => {// jwtHelperObj.verifyAccessToken,
    try {
        // const role_type = req.aud.split(":")[1]; // Ensure you have middleware to decode JWT and add it to req
        // if (role_type !== "WAREHOUSE_MANAGER") {
        //     return res.status(401).json({
        //         status: 401,
        //         message: "Unauthorized access. Only Warehouse Manager can upload data."
        //     });
        // }

        if (!req.file || !isCsvFile(req.file)) {
            return res.status(400).json({ status: 400, message: "Invalid file format. Please upload a CSV file." });
        }

        const bulkUploadServiceObj = new BulkUploadService();
        const result = await bulkUploadServiceObj.processCsvFile(req.file.buffer);
        res.json(result);
    } catch (err) {
        console.error("Error while uploading the data:", err.message);
        next(err);
    }
});

module.exports = router;


module.exports = router;
