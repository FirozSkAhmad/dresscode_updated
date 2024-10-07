const express = require('express');
const { uploadFile, uploadPdfToS3 } = require("../../AWS/aws")
const multer = require('multer');
const upload = multer();
const router = express.Router();
const Bill = require('../utils/Models/billingModel');
const BillEditReq = require('../utils/Models/billEditReqModel');

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

router.post('/addInvoice/:billId', upload.single('pdf'), async (req, res) => {
    const { billId } = req.params


    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const buffer = Buffer.from(req.file.buffer);

    try {
        const s3Url = await uploadPdfToS3(buffer, req.file.originalname, "invoices");
        // console.log("S3 URL of the uploaded PDF:", s3Url);
        // Respond with the S3 URL or another success message

        // Find the bill by billId
        const bill = await Bill.findOne({ billId: billId });

        // If no bill is found, return an error
        if (!bill) {
            return { success: false, message: 'Bill not found' };
        }

        // Update the invoiceUrl with the provided S3 URL
        bill.invoiceUrl = s3Url;

        // Save the updated bill
        await bill.save();

        res.json({
            message: 'Successfully updated the invoice in the bill and added the invoice to S3.',
        });
    } catch (error) {
        console.error("Failed to upload PDF to S3", error);
        res.status(500).json({ error: 'Error while uploading to S3' });
    }
});

router.post('/updateInvoice', upload.single('pdf'), async (req, res) => {
    const { billId, editBillReqId } = req.body

    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const buffer = Buffer.from(req.file.buffer);

    try {
        const s3Url = await uploadPdfToS3(buffer, req.file.originalname, "invoices");
        // console.log("S3 URL of the uploaded PDF:", s3Url);
        // Respond with the S3 URL or another success message

        // Find the bill by billId
        const bill = await Bill.findOne({ billId: billId });
        const billEditReq = await BillEditReq.findOne({ editBillReqId: editBillReqId });

        // If no bill is found, return an error
        if (!bill) {
            return { success: false, message: 'Bill not found' };
        }

        // If no bill is found, return an error
        if (!billEditReq) {
            return { success: false, message: 'Bill Edit Req not found' };
        }


        // Update the invoiceUrl with the provided S3 URL
        bill.invoiceUrl = s3Url;
        billEditReq.approvedInvoiceUrl = s3Url;

        // Save the updated bill
        await bill.save();
        await billEditReq.save();

        res.json({
            message: 'Successfully updated the invoice in the bill.',
        });
    } catch (error) {
        console.error("Failed to upload PDF to S3", error);
        res.status(500).json({ error: 'Error while uploading to S3' });
    }
});

module.exports = router;