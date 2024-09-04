const express = require('express');
const { uploadFile, uploadPdfToS3 } = require("../../AWS/aws")
const multer = require('multer');
const upload = multer();
const router = express.Router();

router.post('/generateImgUrl', multer().any(), async (req, res) => {
    try {
        const files = req.files; // Assuming files are attached in req.files

        if (!files || files.length === 0 || files[0].fieldname !== "image") {
            return res.status(400).json({ error: "Required profileImage as key and file as value" });
        }

        const file = files[0];

        if (!["image/png", "image/jpg", "image/jpeg"].includes(file.mimetype)) {
            return res.status(400).json({ error: "Only .png, .jpg and .jpeg formats are allowed!" });
        }

        const uploadedFileURL = await uploadFile(file, "DresscodeImgs");

        res.status(200).json({
            status: 'success',
            imgURL: uploadedFileURL,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/addInvoice', upload.single('pdf'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const buffer = Buffer.from(req.file.buffer);

    try {
        const s3Url = await uploadPdfToS3(buffer, req.file.originalname, "invoices");
        // console.log("S3 URL of the uploaded PDF:", s3Url);
        // Respond with the S3 URL or another success message
        res.json({ s3Url: s3Url });
    } catch (error) {
        console.error("Failed to upload PDF to S3", error);
        res.status(500).json({ error: 'Error while uploading to S3' });
    }
});

module.exports = router;