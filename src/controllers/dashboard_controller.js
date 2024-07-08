const express = require('express');
const UserService = require('../services/user_service');
const Constants = require('../utils/Constants/response_messages')
const JwtHelper = require('../utils/Helpers/jwt_helper')
const jwtHelperObj = new JwtHelper();
const router = express.Router()
const UploadedHistoryModel = require('../utils/Models/uploadedHistoryModel');
const HealModel = require('../utils/Models/healModel');
const ShieldModel = require('../utils/Models/shieldModel');
const EliteModel = require('../utils/Models/eliteModel');
const TogsModel = require('../utils/Models/togsModel');
const SpiritsModel = require('../utils/Models/spiritsModel');
const WorkWearModel = require('../utils/Models/workWearModel');
const OrderModel = require('../utils/Models/orderModel');
const QuoteModel = require('../utils/Models/quoteModel');

const modelMap = {
    "HEAL": HealModel,
    "SHIELD": ShieldModel,
    "ELITE": EliteModel,
    "TOGS": TogsModel,
    "SPIRIT": SpiritsModel,
    "WORK WEAR UNIFORMS": WorkWearModel
};

// GET endpoint to retrieve upload history summaries
router.get('/uploadHistories', async (req, res) => {
    try {
        const histories = await UploadedHistoryModel.find({}, 'uploadedId uploadedDate totalAmountOfUploaded -_id').exec();
        res.status(200).send({
            message: "Upload histories retrieved successfully",
            data: histories
        });
    } catch (error) {
        console.error("Failed to retrieve upload histories:", error);
        res.status(500).send({ message: "Failed to retrieve upload histories", error: error.message });
    }
});

router.get('/uploadedHistory/:uploadedId/products', async (req, res) => {
    const { uploadedId } = req.params;

    try {
        const history = await UploadedHistoryModel.findOne({ uploadedId });
        if (!history) {
            return res.status(404).send({ message: "Upload history not found" });
        }

        // Retrieve product details for each product in the history
        const productsDetails = await Promise.all(history.products.map(async (product) => {
            const ProductModel = modelMap[product.group];
            if (!ProductModel) {
                throw new Error(`No model found for group: ${product.group}`);
            }
            const productDetails = await ProductModel.findOne({ productId: product.productId })
                .select('-variants -reviews -_id');

            return { ...product.toObject(), productDetails };
        }));

        res.status(200).send({
            message: "Product details retrieved successfully",
            historyDetails: {
                uploadedId: history.uploadedId,
                uploadedDate: history.uploadedDate,
                totalAmountOfUploaded: history.totalAmountOfUploaded
            },
            products: productsDetails
        });
    } catch (error) {
        console.error("Failed to retrieve product details:", error);
        res.status(500).send({ message: "Failed to retrieve product details", error: error.message });
    }
});

// DELETE endpoint to logically delete a product
router.patch('/deleteProduct', async (req, res) => {
    const { group, productId } = req.body;

    try {
        const ProductModel = modelMap[group];
        if (!ProductModel) {
            return res.status(404).send({ message: "Invalid product group" });
        }

        // Update the product's isDeleted status
        const updatedProduct = await ProductModel.findOneAndUpdate(
            { productId: productId },
            { $set: { isDeleted: true } },
            { new: true }  // Returns the modified document
        );

        if (!updatedProduct) {
            return res.status(404).send({ message: "Product not found" });
        }

        res.status(200).send({
            message: "Product deleted successfully",
            // product: updatedProduct
        });
    } catch (error) {
        console.error("Failed to delete product:", error);
        res.status(500).send({ message: "Failed to delete product", error: error.message });
    }
});

router.patch('/updateProductDetails', async (req, res) => {
    const { group, productId, color, size, newPrice, newQuantity } = req.body;

    try {
        const ProductModel = modelMap[group];
        if (!ProductModel) {
            return res.status(404).send({ message: "Invalid product group" });
        }

        // Find the product and update its price
        const product = await ProductModel.findOne({ productId: productId });
        if (!product) {
            return res.status(404).send({ message: "Product not found" });
        }

        // Update the price of the product
        product.price = newPrice;

        // Find and update the specific variant's quantity
        const variant = product.variants.find(v => v.color === color);
        if (!variant) {
            return res.status(404).send({ message: "Variant not found" });
        }

        const variantSize = variant.variantSizes.find(v => v.size === size);
        if (!variantSize) {
            return res.status(404).send({ message: "Variant size not found" });
        }

        // Update the quantity
        variantSize.quantity = newQuantity;

        // Save the updated product
        await product.save();

        res.status(200).send({
            message: "Product details updated successfully",
            // product: product
        });
    } catch (error) {
        console.error("Failed to update product details:", error);
        res.status(500).send({ message: "Failed to update product details", error: error.message });
    }
});

// Route to get all products
router.get('/:groupName/getAllActiveProducts', async (req, res) => {
    try {
        const { groupName } = req.params
        const allProducts = [];
        // Loop through each model in the modelMap
        // for (const modelName in modelMap) {
        const model = modelMap[groupName];  // Get the model reference from the map
        const products = await model.find({ isDeleted: false }).populate('variants'); // Fetch products where isDeleted is false
        allProducts.push(...products); // Spread and push the products into the allProducts array
        // }

        const formattedProducts = allProducts.map(product => ({
            group: product.group.name ? product.group.name : null,
            productId: product.productId,
            category: product?.category.name ? product.category.name : null,
            subCategory: product?.subCategory.name ? product.subCategory.name : null,
            gender: product.gender,
            productType: product.productType.type,
            fit: product?.fit ? product.fit : null,
            neckline: product?.neckline ? product.neckline.name : null,
            sleeves: product?.sleeves ? product.sleeves.name : null,
            fabric: product?.fabric ? product.fabric.name : null,
            productDetails: product.productDetails,
            price: product.price,
            variants: product.variants.map(variant => ({
                color: variant.color,
                sizes: variant.variantSizes.map(size => ({
                    size: size.size,
                    quantity: size.quantity
                }))
            }))
        }));

        res.status(200).json({
            message: "Active products retrieved successfully",
            products: formattedProducts
        });
    } catch (error) {
        console.error("Failed to fetch active products:", error);
        res.status(500).send({ message: "Failed to retrieve active products", error: error.message });
    }
});

router.get('/getOders', async (req, res) => {
    try {
        const orders = await OrderModel.find({}, 'orderId dateOfOrder status -_id').exec();
        res.status(200).send({
            message: "Upload histories retrieved successfully",
            orders: orders
        });
    } catch (error) {
        console.error("Failed to retrieve upload histories:", error);
        res.status(500).send({ message: "Failed to retrieve upload histories", error: error.message });
    }
});

router.get('/getOrderDetails/:orderId', async (req, res) => {
    const { orderId } = req.params;

    try {
        const order = await OrderModel.findOne({ orderId }).populate('user');
        if (!order) {
            return res.status(404).send({ message: "Order not found" });
        }

        const user = order.user;
        const address = user.addresses.id(order.address);  // Access subdocument by ID directly from user document
        // Extract only the desired fields from the address
        const addressDetails = {
            name: address.name,
            mobile: address.mobile,
            flatNumber: address.flatNumber,
            locality: address.locality,
            pinCode: address.pinCode,
            landmark: address.landmark,
            districtCity: address.districtCity,
            state: address.state,
            addressType: address.addressType
        };

        const ProductModel = modelMap[order.group];
        if (!ProductModel) {
            return res.status(404).send({ message: "Product group not recognized" });
        }

        const product = await ProductModel.findOne({ productId: order.productId })
            .select('-variants -reviews');

        if (!product) {
            return res.status(404).send({ message: "Product not found" });
        }

        res.status(200).json({
            message: "Order and product details retrieved successfully",
            orderDetails: {
                orderId: order.orderId,
                productDetails: product,
                color: order.color,
                size: order.size,
                price: order.price,
                logoUrl: order.logoUrl,
                logoPosition: order.logoPosition,
                quantityOrdered: order.quantityOrdered,
                userDetails: {
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    gender: user.gender,
                    phoneNumber: user.phoneNumber
                },
                addressDetails: addressDetails,
                deliveryStatus: order.deliveryStatus,
                dateOfOrder: order.dateOfOrder,
                estimatedDelivery: order.estimatedDelivery
            }
        });
    } catch (error) {
        console.error("Failed to retrieve order details:", error);
        res.status(500).send({ message: "Failed to retrieve order details", error: error.message });
    }
});

router.get('/getOders', async (req, res) => {
    try {
        const orders = await OrderModel.find({}, 'orderId dateOfOrder status -_id').exec();
        res.status(200).send({
            message: "Upload histories retrieved successfully",
            orders: orders
        });
    } catch (error) {
        console.error("Failed to retrieve upload histories:", error);
        res.status(500).send({ message: "Failed to retrieve upload histories", error: error.message });
    }
});

router.get('/getQuotes', async (req, res) => {
    try {
        const quotesWithUserDetails = await QuoteModel.find()
            .populate({
                path: 'user',
                select: 'firstName lastName phoneNumber -_id'  // Selecting specific user fields
            })

        const formattedQuotes = quotesWithUserDetails.map(quote => ({
            quoteID: quote.quoteId,  // Using the custom generated quoteId
            dateOfQuoteRecived: quote.dateOfQuoteRecived,
            clientName: `${quote.user.firstName} ${quote.user.lastName}`,  // Combining first and last name
            phoneNo: quote.user.phoneNumber
        }));

        res.status(200).json(formattedQuotes);
    } catch (error) {
        console.error('Failed to retrieve quotes:', error);
        res.status(500).json({ message: 'Failed to retrieve quotes', error: error.message });
    }
});

router.get('/getQuoteDetails/:quoteId', async (req, res) => {
    const { quoteId } = req.params;


    try {
        const quote = await QuoteModel.findOne({ quoteId }).populate('user');
        if (!quote) {
            return res.status(404).send({ message: "Quote not found" });
        }

        const ProductModel = modelMap[quote.group];
        if (!ProductModel) {
            return res.status(400).send({ message: "Invalid product group" });
        }

        const product = await ProductModel.findOne({ productId: quote.productId })
            .select('-variants -reviews');  // Exclude variants and reviews from the output

        if (!product) {
            return res.status(404).send({ message: "Product not found" });
        }

        // Preparing the detailed response
        const response = {
            quoteId: quote.quoteId,
            dateOfQuoteRecived: quote.dateOfQuoteRecived,
            userDetails: {
                name: quote.user.name,
                email: quote.user.email,
                phoneNumber: quote.user.phoneNumber
            },
            productDetails: {
                // group: quote.group,
                // productId: quote.productId,
                product,
                color: quote.color,
                size: quote.size,
                quantityRequired: quote.quantityRequired,
                logoUrl: quote.logoUrl,
                logoPosition: quote.logoPosition
            },
            addressDetails: quote.address
        };

        res.status(200).json(response);
    } catch (error) {
        console.error("Failed to retrieve quote details:", error);
        res.status(500).send({ message: "Failed to retrieve quote details", error: error.message });
    }
});

module.exports = router;
