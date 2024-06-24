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
        const { groupName } = req.body
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getCategories(groupName);
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});


router.get('/getSubCategories', async (req, res, next) => {
    try {
        const { groupName, category } = req.body
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getSubCategories(groupName, category);
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});

router.get('/getProductTypes', async (req, res, next) => {
    try {
        const { groupName, category, subCategory } = req.body
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getProductTypes(groupName, category, subCategory);
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});

router.get('/getProductFilters', async (req, res, next) => {
    try {
        const { groupName, category, subCategory, gender, productType } = req.body
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getProductFilters(groupName, category, subCategory, gender, productType);
        res.status(200).send(result)
    } catch (err) {
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
        const { groupName, category, subCategory, gender, productType, fit, color, size, neckline, sleeves } = req.body
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getProductsByFilters(groupName, category, subCategory, gender, productType, fit, color, size, neckline, sleeves);
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
        const { groupName, productId, size, color } = req.body
        const EComServiceObj = new EComService();
        const result = await EComServiceObj.getProductDetailsWithSpecificVariant(groupName, productId, size, color);
        res.status(200).send(result)
    } catch (err) {
        next(err);
    }
});

module.exports = router;