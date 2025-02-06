const express = require('express');
const router = express.Router();
const Contact = require('../utils/Models/contactModel'); // Import the Contact model

// POST route to save contact information
router.post('/save-info', async (req, res) => {
    try {
        const { name, email, mobile, category, message, organization } = req.body;

        // Create a new contact document
        const newContact = new Contact({
            name,
            email,
            mobile,
            category,
            message,
            organization
        });

        // Save the document to the database
        const savedContact = await newContact.save();

        // Send a success response
        res.status(201).json({
            message: 'Contact information saved successfully',
            // data: savedContact
        });
    } catch (error) {
        // Handle errors
        res.status(500).json({
            message: 'An error occurred while saving contact information',
            error: error.message
        });
    }
});

module.exports = router;