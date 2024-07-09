const express = require('express');
const { uploadFile } = require("../../AWS/aws")
const multer = require("multer");
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


module.exports = router;