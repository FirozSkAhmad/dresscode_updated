const express = require('express');
const EComService = require('../services/e-com_service');
const Constants = require('../utils/Constants/response_messages')
const JwtHelper = require('../utils/Helpers/jwt_helper')
const jwtHelperObj = new JwtHelper();
const router = express.Router()

router.get('/getGroups', async (req, res, next) => {
    try {
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getGroups();
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});


router.get('/getCategories', async (req, res, next) => {
    try {
        const { groupName } = req.query
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getCategories(groupName);
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});


router.get('/getSubCategories', async (req, res, next) => {
    try {
        const { groupName, category } = req.query
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getSubCategories(groupName, category);
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});

router.get('/getProductTypes', async (req, res, next) => {
    try {
        const { groupName, category, subCategory } = req.query
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getProductTypes(groupName, category, subCategory);
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});

router.get('/getProductFilters', async (req, res, next) => {
    try {
        const { groupName, category, subCategory, gender, productType } = req.query
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getProductFilters(groupName, category, subCategory, gender, productType);
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});

// Route to get filters for a specific group with colors and sizes
router.get('/getFiltersByGroup', async (req, res) => {
    try {
        const groupName = req.query.groupName.toUpperCase(); // Assuming group is case-insensitive
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getFiltersByGroup(groupName);
        res.status(200).send(result)
    } catch (err) {
        console.error('Failed to retrieve group filters:', err.message);
        next(err);
    }
});

router.get('/getFits', async (req, res, next) => {
    try {
        const { groupName, category, subCategory, gender, productsType } = req.query
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getFits(groupName, category, subCategory, gender, productsType);
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});

router.get('/getColors', async (req, res, next) => {
    try {
        const { groupName, category, subCategory, gender, productsType } = req.query
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getColors(groupName, category, subCategory, gender, productsType);
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});

router.get('/getSizes', async (req, res, next) => {
    try {
        const { groupName, category, subCategory, gender, productsType } = req.query
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getSizes(groupName, category, subCategory, gender, productsType);
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});

router.get('/getNecklines', async (req, res, next) => {
    try {
        const { groupName, category, subCategory, gender, productsType } = req.query
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getNecklines(groupName, category, subCategory, gender, productsType);
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});

router.get('/getSleeves', async (req, res, next) => {
    try {
        const { groupName, category, subCategory, gender, productsType } = req.query
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getSleeves(groupName, category, subCategory, gender, productsType);
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});

router.get('/getProductsByFilters', async (req, res, next) => {
    try {
        const { groupName, category, subCategory, gender, productType, fit, color, size, neckline, sleeves } = req.query
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getProductsByFilters(groupName, category, subCategory, gender, productType, fit, color, size, neckline, sleeves);
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});

router.get('/getAllSchoolNames', async (req, res, next) => {
    try {
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getAllSchoolNames();
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});

router.get('/getProductsByGroup', async (req, res, next) => {
    try {
        let { groupName, color, size } = req.query;

        // Convert query parameter values to uppercase
        groupName = groupName?.toUpperCase();
        color = color?.toUpperCase();
        size = size?.toUpperCase();

        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getProductsByGroup(groupName, color, size);
        res.status(200).send(result);
    } catch (err) {
        next(err);
    }
});


router.get('/getProductsByGroupAndSchoolName', async (req, res, next) => {
    try {
        const groupName = decodeURIComponent(req.query.groupName);
        const schoolName = decodeURIComponent(req.query.schoolName);

        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getProductsByGroupAndSchoolName(groupName, schoolName);
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});

router.get('/getProductVariantAvaColors', async (req, res, next) => {
    try {
        const { groupName, productId } = req.body
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getProductVariantAvaColors(groupName, productId);
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});

router.get('/getAvaSizesByColor', async (req, res, next) => {
    try {
        const { groupName, productId, color } = req.body
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getAvaSizesByColor(groupName, productId, color);
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});

router.get('/getProductDetailsWithSpecificVariant', async (req, res, next) => {
    try {
        let { groupName, productId, size, color } = req.query;

        // Convert all query parameters except productId to uppercase
        groupName = groupName?.toUpperCase();
        size = size?.toUpperCase();
        color = color?.toUpperCase();

        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getProductDetailsWithSpecificVariant(groupName, productId, size, color);
        res.status(200).send(result);
    } catch (err) {
        next(err);
    }
});


module.exports = router;