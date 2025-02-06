const express = require('express');
const Constants = require('../utils/Constants/response_messages')
const JwtHelper = require('../utils/Helpers/jwt_helper')
const jwtHelperObj = new JwtHelper();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const router = express.Router()
const UploadedHistoryModel = require('../utils/Models/uploadedHistoryModel');
const HealModel = require('../utils/Models/healModel');
const EliteModel = require('../utils/Models/eliteModel');
const TogsModel = require('../utils/Models/togsModel');
const ReturnOrdersModel = require('../utils/Models/returnOrdersModel');
const OrderModel = require('../utils/Models/orderModel');
const QuoteModel = require('../utils/Models/quoteModel');
const dimensionsModel = require('../utils/Models/dimensionsModel');
const DashboardUserModel = require('../utils/Models/dashboardUserModel');
const csvWriter = require('csv-writer').createObjectCsvStringifier; // Import csv-writer
const ExcelJS = require('exceljs');
const bwipjs = require('bwip-js');
const axios = require('axios');
const { startSession } = require('mongoose');
require('dotenv').config();  // Make sure to require dotenv if you need access to your .env variables
const DashboardService = require('../services/dashboard_service');
const dashboardServiceObj = new DashboardService();
const nodemailer = require('nodemailer');
const Bill = require('../utils/Models/billingModel');
const Contact = require('../utils/Models/contactModel');
const { Parser } = require('json2csv'); // Import json2csv

const modelMap = {
    "HEAL": HealModel,
    "ELITE": EliteModel,
    "TOGS": TogsModel,
};

router.get('/get-contacts', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        // Fetch all contacts from the database
        const contacts = await Contact.find();

        // Send the contacts as a response
        res.status(200).json({
            message: 'Contacts retrieved successfully',
            data: contacts
        });
    } catch (error) {
        // Handle errors
        res.status(500).json({
            message: 'An error occurred while fetching contacts',
            error: error.message
        });
    }
});

// GET route to download contact data as CSV
router.get('/download-contacts', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        // Fetch all contacts from the database
        const contacts = await Contact.find();

        // Define the fields for the CSV
        const fields = [
            'name',
            'email',
            'mobile',
            'category',
            'message',
            'organization',
            'date',
        ];

        // Create a JSON2CSV parser
        const json2csvParser = new Parser({ fields });

        // Convert JSON data to CSV
        const csv = json2csvParser.parse(contacts);

        // Set headers for file download
        res.header('Content-Type', 'text/csv');
        res.attachment('contacts.csv'); // Set the file name

        // Send the CSV file as a response
        res.send(csv);
    } catch (error) {
        // Handle errors
        res.status(500).json({
            message: 'An error occurred while generating the CSV file',
            error: error.message
        });
    }
});

router.post('/createDashboardUser', async (req, res) => {
    const session = await mongoose.startSession(); // Start a new session for the transaction
    session.startTransaction(); // Start the transaction
    try {
        const { name, email, phoneNumber, password, roleType, role } = req.body;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userPayload = {
            name,
            email: email.toLowerCase(), // Ensure the email is stored in lowercase
            phoneNumber,
            password: hashedPassword,
            roleType,
            role
        };

        const newUser = await DashboardUserModel.create([userPayload], { session: session }); // Include the session in the create operation
        await session.commitTransaction(); // Commit the transaction if all operations are successful
        session.endSession(); // End the session
        res.status(201).send({ message: 'User created successfully', user: newUser });
    } catch (error) {
        await session.abortTransaction(); // Abort the transaction on error
        session.endSession(); // End the session
        res.status(500).send({ message: 'Error creating user', error: error.message });
    }
});

router.post('/dashboardLogin', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate the input
        if (!email || !password) {
            return res.status(400).send({ status: 400, message: "Email and password must be provided" });
        }

        const userData = await DashboardUserModel.findOne({ email: email.toLowerCase() });

        if (!userData) {
            return res.status(400).send({ status: 400, message: "No user exists with given email" });
        }

        const isValid = await bcrypt.compare(password, userData.password);
        if (!isValid) {
            return res.status(400).send({ status: 400, message: "Incorrect Password" });
        }

        const tokenPayload = `${userData._id}:${userData.roleType}:${userData.name}`;
        const accessToken = await jwtHelperObj.generateAccessToken(tokenPayload);
        const refreshToken = await jwtHelperObj.generateRefreshToken(tokenPayload);

        // Set the refresh token in an HTTP-only cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,    // Prevents JavaScript from accessing the cookie
            secure: true, // Required when sameSite is 'None'
            sameSite: 'None',
            path: '/'
        });

        const data = {
            accessToken: accessToken,
            userId: userData._id,
            name: userData.name,
            roleType: userData.roleType,
            role: userData.role
        };

        res.send({ status: 200, message: "Success", data: data });
    } catch (err) {
        console.error("Error in loginUser: ", err.message);
        next(err); // Pass to the default error handler
    }
});

router.post('/forgot-password', async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await dashboardServiceObj.forgotPassword(req.body, session);
        await session.commitTransaction();
        res.status(200).send(result);
    } catch (err) {
        await session.abortTransaction();
        console.error("Transaction aborted due to an error:", err.message);
        next(err);
    } finally {
        session.endSession();
    }
});

router.post('/reset-password', async (req, res, next) => {
    const { token, newPassword } = req.body;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await dashboardServiceObj.resetPassword(token, newPassword, session);
        await session.commitTransaction();
        res.status(201).send(result);
    } catch (err) {
        await session.abortTransaction();
        console.error("Transaction aborted due to an error:", err.message);
        next(err);
    } finally {
        session.endSession();
    }
});

// GET endpoint to retrieve upload history summaries
router.get('/uploadHistories', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const histories = await UploadedHistoryModel.find({}, 'uploadedId uploadedDate totalAmountOfUploaded -_id').sort({ uploadedDate: -1 }).exec();
        res.status(200).send({
            message: "Upload histories retrieved successfully",
            data: histories
        });
    } catch (error) {
        console.error("Failed to retrieve upload histories:", error);
        res.status(500).send({ message: "Failed to retrieve upload histories", error: error.message });
    }
});

router.get('/uploadedHistory/:uploadedId/products', jwtHelperObj.verifyAccessToken, async (req, res) => {
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

// GET endpoint to get the overview of stock (quantity and amount) and orders (group-wise and total)
router.get('/getOverview', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        // Fetch all upload histories for stock overview
        const uploadHistories = await UploadedHistoryModel.find({});

        // Initialize a stock object to hold the group-wise and total stock quantity, amount, and order counts
        let stock = {};
        let totalAmount = 0;
        let totalQuantity = 0;
        let totalOnlineOrders = 0;
        let totalCanceledOrders = 0;

        // Loop through each upload history and calculate group-wise stock quantity and amount
        for (const history of uploadHistories) {
            await Promise.all(history.products.map(async (product) => {
                const ProductModel = modelMap[product.group];
                if (!ProductModel) {
                    throw new Error(`No model found for group: ${product.group}`);
                }
                // Retrieve the product details based on productId
                const productDetails = await ProductModel.findOne({ productId: product.productId })
                    .select('price'); // Only select the price field

                if (!productDetails) {
                    throw new Error(`No product details found for productId: ${product.productId}`);
                }

                // Initialize variables for this product's group
                let groupTotalAmount = 0;
                let groupTotalQuantity = 0;

                // Calculate the stock amount and quantity for each variant in the product
                product.variants.forEach(variant => {
                    variant.variantSizes.forEach(size => {
                        const quantity = size.quantityOfUpload;
                        const amount = quantity * productDetails.price; // Multiply quantity by price

                        groupTotalAmount += amount;
                        groupTotalQuantity += quantity;
                    });
                });

                // Update the stock for the group (amount, quantity)
                if (!stock[product.group]) {
                    stock[product.group] = {
                        amount: 0, quantity: 0, onlineOrders: 0, canceledOrders: 0, offlineOrders: "N/A"
                    };
                }
                stock[product.group].amount += groupTotalAmount;
                stock[product.group].quantity += groupTotalQuantity;

                totalAmount += groupTotalAmount; // Add to total stock amount
                totalQuantity += groupTotalQuantity; // Add to total stock quantity
            }));
        }

        // Fetch all orders for order overview
        const orders = await OrderModel.find({});

        // Loop through each order and count onlineOrders by group
        orders.forEach(order => {
            if (order.order_created) {
                totalOnlineOrders += 1; // Increment total online orders count

                order.products.forEach(product => {
                    if (!stock[product.group]) {
                        stock[product.group] = {
                            amount: 0, quantity: 0, onlineOrders: 0, canceledOrders: 0, offlineOrders: "N/A"
                        };
                    }
                    stock[product.group].onlineOrders += 1; // Increment the online order count for the group

                    // Check if the order is canceled
                    if (order.dateOfCanceled) {
                        totalCanceledOrders += 1;
                        stock[product.group].canceledOrders += 1; // Increment canceled orders count
                    }
                });
            }
        });

        // Fetch active bills for offline orders
        const togsOfflineBills = await Bill.countDocuments({ isDeleted: false, 'products.group': 'TOGS' });

        // Assign offline orders for TOGS
        if (stock['TOGS']) {
            stock['TOGS'].offlineOrders = togsOfflineBills;
        }

        // Include the total amount, quantity, and orders in the stock object
        stock.total = {
            amount: totalAmount,
            quantity: totalQuantity,
            onlineOrders: totalOnlineOrders,
            offlineOrders: togsOfflineBills, // Only TOGS offline bills
            canceledOrders: totalCanceledOrders,
        };

        // Send the response
        res.status(200).send(stock);
    } catch (error) {
        console.error("Failed to fetch overview details:", error);
        res.status(500).send({ message: "Failed to fetch overview details", error: error.message });
    }
});



// DELETE endpoint to logically delete a Variant
router.delete('/removeVariant', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { group, styleCoat } = req.body;

    // Start a MongoDB session for the transaction
    const session = await mongoose.startSession();
    try {
        session.startTransaction();  // Start the transaction

        const ProductModel = modelMap[group];
        if (!ProductModel) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).send({ message: "Invalid product group" });
        }

        // Pull the variant with the specified styleCoat from the variants array
        const updatedProduct = await ProductModel.findOneAndUpdate(
            { 'variants.variantSizes.styleCoat': styleCoat },  // Find the product by styleCoat
            {
                $pull: { 'variants.$.variantSizes': { styleCoat: styleCoat } }  // Remove the variant with matching styleCoat
            },
            { new: true, session }  // Ensure this is part of the transaction and return the updated product
        );

        if (!updatedProduct) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).send({ message: "Variant not found" });
        }

        // Commit the transaction after the update is successful
        await session.commitTransaction();
        session.endSession();
        res.status(200).send({
            message: "Variant removed successfully"
        });
    } catch (error) {
        // Handle any errors that occur during the transaction
        await session.abortTransaction();
        session.endSession();
        console.error("Failed to remove variant:", error);
        res.status(500).send({ message: "Failed to remove variant", error: error.message });
    }
});

// PATCH endpoint to update quantity of a specific variant and product-level price
router.patch('/updateVariant', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { group, styleCoat, newQuantity, newPrice } = req.body;

    // Start a MongoDB session for the transaction
    const session = await mongoose.startSession();
    try {
        session.startTransaction();  // Start the transaction

        const ProductModel = modelMap[group];
        if (!ProductModel) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).send({ message: "Invalid product group" });
        }

        // Update the quantity of the specific variant and price at the product level
        const updatedProduct = await ProductModel.findOneAndUpdate(
            { 'variants.variantSizes.styleCoat': styleCoat },  // Find the product by styleCoat
            {
                $set: {
                    'variants.$[].variantSizes.$[size].quantity': newQuantity,
                    'price': newPrice  // Update price at product level
                }
            },
            {
                arrayFilters: [{ 'size.styleCoat': styleCoat }],  // Filter the specific size variant
                new: true, session // Ensure this is part of the transaction and return the updated document
            }
        );

        if (!updatedProduct) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).send({ message: "Variant not found" });
        }

        // Commit the transaction after the update is successful
        await session.commitTransaction();
        session.endSession();
        res.status(200).send({
            message: "Variant quantity and product price updated successfully"
        });
    } catch (error) {
        // Handle any errors that occur during the transaction
        await session.abortTransaction();
        session.endSession();
        console.error("Failed to update variant and price:", error);
        res.status(500).send({ message: "Failed to update variant and price", error: error.message });
    }
});

// Route to get all products
router.get('/:groupName/getAllActiveProducts', jwtHelperObj.verifyAccessToken, async (req, res) => {
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
            group: product.group ? product.group : null,
            productId: product.productId,
            category: product?.category ? product.category : null,
            subCategory: product?.subCategory ? product.subCategory : null,
            schoolName: product?.schoolName ? product.schoolName : null,
            gender: product.gender,
            productType: product.productType,
            fit: product?.fit ? product.fit : null,
            neckline: product?.neckline ? product.neckline : null,
            pattern: product?.pattern ? product.pattern : null,
            cuff: product?.cuff ? product.cuff : null,
            sleeves: product?.sleeves ? product.sleeves : null,
            material: product?.material ? product.material : null,
            fabric: product?.fabric ? product.fabric : null,
            productDescription: product.productDescription,
            price: product.price,
            variants: product.variants.map(variant => ({
                color: variant.color,
                sizes: variant.variantSizes.map(vs => ({
                    size: vs.size,
                    styleCoat: vs.styleCoat,
                    quantity: vs.quantity,
                    hsnCode: vs.hsnCode
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

router.get('/getOrders', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {

        // Extract groups from query params and split by comma
        const { groups } = req.query;
        const allowedGroups = ['ELITE', 'HEAL', 'TOGS']; // Define allowed groups
        const filterGroups = groups ? groups.split(',').filter(group => allowedGroups.includes(group)) : null;

        // Find orders where deliveryStatus is not "Canceled" and order_created is true
        const orders = await OrderModel.find(
            { deliveryStatus: { $ne: 'Canceled' }, order_created: { $ne: false } },
            'orderId dateOfOrder status products -_id' // Include products to extract groups
        ).sort({ dateOfOrder: -1 }).exec();

        // Process orders to extract groups and filter dynamically
        const processedOrders = orders.map(order => {
            // Extract unique group names from the products array
            const groupsInOrder = [...new Set(order.products.map(product => product.group))];

            // Include groups in the order object
            return {
                orderId: order.orderId,
                dateOfOrder: order.dateOfOrder,
                status: order.status,
                groups: groupsInOrder,
            };
        }).filter(order => {
            // If groups filter is provided, only include orders with an exact match for all groups
            return !filterGroups || filterGroups.every(group => order.groups.includes(group));
        });

        res.status(200).send({
            message: "Orders retrieved successfully",
            orders: processedOrders
        });
    } catch (error) {
        console.error("Failed to retrieve orders:", error);
        res.status(500).send({ message: "Failed to retrieve orders", error: error.message });
    }
});

router.get('/getReturnOders', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const returnOrders = await ReturnOrdersModel.find({}, 'returnOrderId dateOfOrder dateOfCanceled dateOfRefunded status -_id').sort({ dateOfOrder: -1 }).exec();
        res.status(200).send({
            message: "Return Orders retrieved successfully",
            return_orders: returnOrders
        });
    } catch (error) {
        console.error("Failed to retrieve upload histories:", error);
        res.status(500).send({ message: "Failed to retrieve upload histories", error: error.message });
    }
});


router.get('/getOrderDetails/:orderId', jwtHelperObj.verifyAccessToken, async (req, res) => {
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
            firstName: address.firstName,
            lastName: address.lastName,
            address: address.address,
            city: address.city,
            pinCode: address.pinCode,
            state: address.state,
            country: address.country,
            state: address.state,
            email: address.email,
            phone: address.phone
        };

        const productsPromises = order.products.map(async (product) => {

            const ProductModel = modelMap[product.group];
            if (!ProductModel) {
                return res.status(404).send({ message: "Product group not recognized" });
            }

            const productDetails = await ProductModel.findOne({ productId: product.productId })
                .select('-variants -reviews');

            if (!productDetails) {
                return res.status(404).send({ message: "Product not found" });
            }

            return {
                group: product.group,
                productId: product.productId,
                color: product.color,
                size: product.size,
                quantityOrdered: product.quantityOrdered,
                price: product.price,
                logoUrl: product.logoUrl,
                name: product.name,
                logoPosition: product.logoPosition,
                slabDiscountPercentage: product.slabDiscountPercentage,
                slabDiscountAmount: product.slabDiscountAmount,
                productDetails: productDetails,
            };
        });

        // Resolve all promises
        const products = await Promise.all(productsPromises);

        res.status(200).json({
            message: "Order and product details retrieved successfully",
            orderDetails: {
                orderId: order.orderId,
                products: products,
                userDetails: {
                    name: user.name,
                    email: user.email,
                    gender: user.gender ? user.gender : "N/A",
                    phoneNumber: user.phoneNumber ? user.phoneNumber : "N/A"
                },
                addressDetails: addressDetails,
                deliveryStatus: order.deliveryStatus,
                refund_payment_status: order.refund_payment_status,
                dateOfRefunded: order.dateOfRefunded,
                dateOfCanceled: order.dateOfCanceled,
                status: order.status,
                dateOfOrder: order.dateOfOrder,
                deliveryCharges: order.deliveryCharges,
                TotalAmount: order.TotalAmount,
                couponCode: order.couponCode,
                couponDiscountPercentage: order.couponDiscountPercentage,
                couponDiscountAmount: order.couponDiscountAmount,
                totalSlabDiscountAmount: order.totalSlabDiscountAmount,
                TotalDiscountAmount: order.TotalDiscountAmount,
                TotalPriceAfterDiscount: order.TotalPriceAfterDiscount,
                estimatedDelivery: order.estimatedDelivery,
                shiprocket_order_id: order.shiprocket_order_id,
                shiprocket_shipment_id: order.shiprocket_shipment_id,
                shiprocket_awb_code: order.shiprocket_awb_code
            }
        });
    } catch (error) {
        console.error("Failed to retrieve order details:", error);
        res.status(500).send({ message: "Failed to retrieve order details", error: error.message });
    }
});

router.get('/getReturnOrderDetails/:returnOrderId', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { returnOrderId } = req.params;

    try {
        const returnOrder = await ReturnOrdersModel.findOne({ returnOrderId }).populate('user');
        if (!returnOrder) {
            return res.status(404).send({ message: "return order not found" });
        }

        const user = returnOrder.user;
        const address = user.addresses.id(order.address);  // Access subdocument by ID directly from user document
        // Extract only the desired fields from the address
        const addressDetails = {
            firstName: address.firstName,
            lastName: address.lastName,
            address: address.address,
            city: address.city,
            pinCode: address.pinCode,
            state: address.state,
            country: address.country,
            state: address.state,
            email: address.email,
            phone: address.phone
        };

        const productsPromises = returnOrder.products.map(async (product) => {

            const ProductModel = modelMap[product.group];
            if (!ProductModel) {
                return res.status(404).send({ message: "Product group not recognized" });
            }

            const productDetails = await ProductModel.findOne({ productId: product.productId })
                .select('-variants -reviews');

            if (!productDetails) {
                return res.status(404).send({ message: "Product not found" });
            }

            return {
                group: product.group,
                productId: product.productId,
                color: product.color,
                size: product.size,
                quantityOrdered: product.quantityOrdered,
                price: product.price,
                logoUrl: product.logoUrl,
                name: product.name,
                logoPosition: product.logoPosition,
                productDescription: productDescription,
            };
        });

        // Resolve all promises
        const products = await Promise.all(productsPromises);

        res.status(200).json({
            message: "Return Order and product details retrieved successfully",
            orderDetails: {
                orderId: returnOrder.orderId,
                products: products,
                userDetails: {
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    gender: user.gender,
                    phoneNumber: user.phoneNumber
                },
                addressDetails: addressDetails,
                deliveryStatus: returnOrder.deliveryStatus,
                status: returnOrder.status,
                dateOfOrder: returnOrder.dateOfOrder,
                TotalAmount: returnOrder.TotalAmount,
                TotalDiscountAmount: returnOrder.TotalDiscountAmount,
                TotalPriceAfterDiscount: returnOrder.TotalPriceAfterDiscount,
                dateOfReturnGenerated: returnOrder.dateOfReturnGenerated,
                shiprocket_shipment_id: returnOrder.shiprocket_shipment_id,
                shiprocket_awb_code: returnOrder.shiprocket_awb_code
            }
        });
    } catch (error) {
        console.error("Failed to retrieve return order details:", error);
        res.status(500).send({ message: "Failed to retrieve order details", error: error.message });
    }
});

// router.get('/getOders', jwtHelperObj.verifyAccessToken, async (req, res) => {
//     try {
//         // Find orders where deliveryStatus is not "Canceled"
//         const orders = await OrderModel.find({ deliveryStatus: { $ne: 'Canceled' }, order_created: { $ne: false } }, 'orderId dateOfOrder status -_id').sort({ dateOfOrder: -1 }).exec();

//         res.status(200).send({
//             message: "Orders retrieved successfully",
//             orders: orders
//         });
//     } catch (error) {
//         console.error("Failed to retrieve orders:", error);
//         res.status(500).send({ message: "Failed to retrieve orders", error: error.message });
//     }
// });

router.get('/getCanceledOrders', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        // Find orders where deliveryStatus is "Canceled"
        const orders = await OrderModel.find(
            { deliveryStatus: 'Canceled', order_created: { $ne: false }, refund_payment_status: 'Pending' },
            'orderId dateOfOrder status -_id'
        ).sort({ dateOfOrder: -1 }).exec();

        res.status(200).send({
            message: "Canceled orders retrieved successfully",
            orders: orders
        });
    } catch (error) {
        console.error("Failed to retrieve canceled orders:", error);
        res.status(500).send({ message: "Failed to retrieve canceled orders", error: error.message });
    }
});

router.patch('/updateRefundStatus/:orderId', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const { orderId } = req.params;


        // Find the order by orderId within the session
        const order = await OrderModel.findOne({ orderId: orderId })
            .populate('user', 'name email') // Populate user fields needed for the email
            .session(session);

        if (!order) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "Order not found" });
        }

        // Update the refund_payment_status
        order.refund_payment_status = 'Completed';

        order.dateOfRefunded = new Date();

        // Save the updated order within the session
        await order.save({ session });

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        // Send refund confirmation email
        sendRefundConfirmationEmail(order);

        res.status(200).send({
            message: `Refund payment status updated successfully.`,
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error("Error updating refund payment status:", error.message);
        res.status(500).send({ message: "Failed to update refund payment status", error: error.message });
    }
});

// Function to send refund confirmation email
async function sendRefundConfirmationEmail(order) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SENDER_EMAIL_ID,
                pass: process.env.SENDER_PASSWORD
            }
        });

        const emailContent = `
            <h2>Refund Processed Successfully</h2>
            <p>Dear ${order.user.name},</p>
            <p>We are pleased to inform you that your refund for the order with ID <strong>${order.orderId}</strong> has been successfully processed.</p>
            <p>The refund was completed on <strong>${new Date(order.dateOfRefunded).toLocaleString()}</strong>.</p>
            <p>You can log in to your DressCode account to review your order details or manage your account:</p>
            <p><a href="https://ecom.dress-code.in/login" target="_blank">Click here to log in</a></p>
            <br>
            <p>If you have any questions or concerns, feel free to contact our support team.</p>
            <br>
            <p>Thank you,</p>
            <p>The DressCode Team</p>
        `;

        await transporter.sendMail({
            from: process.env.SENDER_EMAIL_ID,
            to: order.user.email,
            subject: "Refund Processed Successfully",
            html: emailContent
        });

        console.log("Refund confirmation email sent successfully.");
    } catch (error) {
        console.error("Failed to send refund confirmation email:", error.message);
    }
}


router.get('/getRefundedOrders', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        // Find orders where deliveryStatus is "Canceled"
        const orders = await OrderModel.find(
            { deliveryStatus: 'Canceled', order_created: { $ne: false }, refund_payment_status: 'Completed' },
            'orderId dateOfOrder dateOfRefunded status -_id'
        ).sort({ dateOfRefunded: -1 }).exec();

        res.status(200).send({
            message: "Canceled Refunded retrieved successfully",
            orders: orders
        });
    } catch (error) {
        console.error("Failed to retrieve canceled orders:", error);
        res.status(500).send({ message: "Failed to retrieve canceled orders", error: error.message });
    }
});


router.get('/getCanceledOrders', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        // Find orders where deliveryStatus is "Canceled"
        const orders = await OrderModel.find({ deliveryStatus: 'Canceled', refund_payment_status: null, order_created: { $ne: false } }, 'orderId dateOfOrder dateOfCanceled status -_id').sort({ dateOfCanceled: -1 }).exec();

        res.status(200).send({
            message: "Cancled Orders retrieved successfully",
            canceled_orders: orders
        });
    } catch (error) {
        console.error("Failed to retrieve orders:", error);
        res.status(500).send({ message: "Failed to retrieve orders", error: error.message });
    }
});

router.get('/getQuotes', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const quotesWithUserDetails = await QuoteModel.find()
            .sort({ dateOfQuoteRecived: -1 }) // Sort by dateOfQuoteRecived in descending order
            .populate({
                path: 'user',
                select: 'name email phoneNumber -_id'  // Selecting specific user fields
            })

        const formattedQuotes = quotesWithUserDetails.map(quote => ({
            quoteID: quote.quoteId,  // Using the custom generated quoteId
            dateOfQuoteRecived: quote.dateOfQuoteRecived,
            clientName: `${quote.user.name}`,
            clientEmail: `${quote.user.email}`,
            clientPhoneNo: quote.user.phoneNumber ? quote.user.phoneNumber : "N/A"
        }));

        res.status(200).json(formattedQuotes);
    } catch (error) {
        console.error('Failed to retrieve quotes:', error);
        res.status(500).json({ message: 'Failed to retrieve quotes', error: error.message });
    }
});

router.get('/getQuoteDetails/:quoteId', jwtHelperObj.verifyAccessToken, async (req, res) => {
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
                imgUrl: quote.imgUrl,
                logoUrl: quote.logoUrl,
                name: quote.name,
                logoPosition: quote.logoPosition,
            },
            addressDetails: quote.address
        };

        res.status(200).json(response);
    } catch (error) {
        console.error("Failed to retrieve quote details:", error);
        res.status(500).send({ message: "Failed to retrieve quote details", error: error.message });
    }
});

router.get('/predefined/boxes', async (req, res) => {
    try {
        const boxes = await dimensionsModel.find().select('predefinedId boxLength boxBreadth boxHeight').exec();
        if (!boxes || boxes.length === 0) {
            res.status(404).json({ message: 'No boxes found' });
        } else {
            res.status(200).json(boxes);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching boxes' });
    }
});

router.post('/assignToShipRocket/:orderId', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const session = await startSession();
    try {
        session.startTransaction();
        const { orderId } = req.params;
        const data = req.body;
        const { boxLength, boxBreadth, boxHeight } = data
        const order = await OrderModel.findOne({ orderId }).populate('user');
        if (!order) {
            return res.status(404).send({ message: "Order not found" });
        }

        const user = order.user;
        const address = user.addresses.id(order.address);  // Access subdocument by ID directly from user document
        // Extract only the desired fields from the address
        const addressDetails = {
            firstName: address.firstName,
            lastName: address.lastName,
            address: address.address,
            city: address.city,
            pinCode: address.pinCode,
            state: address.state,
            country: address.country,
            state: address.state,
            email: address.email,
            phone: address.phone
        };

        const productsPromises = order.products.map(async (product) => {
            const ProductModel = modelMap[product.group];
            const productDoc = await ProductModel.findOne({ productId: product.productId });
            const variant = productDoc.variants.find(v => v.color.name === product.color.name);
            const variantSize = variant.variantSizes.find(v => v.size === product.size);
            const unitDiscount = (product.slabDiscountAmount / product.quantityOrdered)

            return {
                groupName: product.group,
                productId: product.productId,
                productName: `${productDoc.group}-${productDoc.productType}-${product.color.name}`,
                color: product.color,
                size: product.size,
                sku: variantSize.sku,
                styleCoat: variantSize.styleCoat,
                quantityOrdered: product.quantityOrdered,
                price: product.price,
                logoUrl: product.logoUrl,
                name: product.name,
                logoPosition: product.logoPosition,
                unitDiscount: unitDiscount
            };
        });

        // Resolve all promises
        const products = await Promise.all(productsPromises);

        const requiredData = {
            order_id: orderId,
            order_date: formatDate(order.dateOfOrder),
            pickup_location: "Primary",
            billing_customer_name: addressDetails.firstName,
            billing_last_name: addressDetails.lastName,
            billing_address: addressDetails.address,
            billing_city: addressDetails.city,
            billing_pincode: addressDetails.pinCode,
            billing_state: addressDetails.state,
            billing_country: addressDetails.country,
            billing_email: addressDetails.email,
            billing_phone: addressDetails.phone,
            shipping_is_billing: true,
            order_items: products.map(item => ({
                name: item.productName,
                sku: item.styleCoat,
                units: item.quantityOrdered,
                selling_price: item.price.toString(),
                discount: item.unitDiscount.toString()
                // tax: "",
            })),
            payment_method: "Prepaid",
            shipping_charges: order.deliveryCharges,
            total_discount: order.TotalDiscountAmount,
            sub_total: order.TotalAmount,
            length: data.boxLength,
            breadth: data.boxBreadth,
            height: data.boxHeight,
            weight: data.boxWeight
        };

        // Configure Axios for the API request to Shiprocket
        let createOrderResponse;
        try {
            createOrderResponse = await axios.post(`${process.env.SHIPROCKET_API_URL}/v1/external/orders/create/adhoc`, requiredData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.SHIPROCKET_API_TOKEN}`,
                },
            });
        } catch (error) {
            throw new Error(`Failed to create order in Shiprocket: ${error.response?.data?.message || error.message}`);
        }

        // Data for courier assignment
        const assignCourierData = {
            shipment_id: createOrderResponse.data.shipment_id,
            // courier_id: data.courierId ? data.courierId : "24"
        };

        // Second API call to assign a courier
        let assignCourierResponse;
        try {
            assignCourierResponse = await axios.post(`${process.env.SHIPROCKET_API_URL}/v1/external/courier/assign/awb`, assignCourierData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.SHIPROCKET_API_TOKEN}`,
                },
            });
        } catch (error) {
            throw new Error(`Failed to assign courier in Shiprocket: ${error.response?.data?.message || error.message}`);
        }

        // Prepare data for generating a pickup
        const pickupData = {
            shipment_id: [createOrderResponse.data.shipment_id]
        };

        // Third API call to generate a pickup

        let generatePickupResponse;
        try {
            generatePickupResponse = await axios.post(`${process.env.SHIPROCKET_API_URL}/v1/external/courier/generate/pickup`, pickupData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.SHIPROCKET_API_TOKEN}`,
                },
            });
        } catch (error) {
            throw new Error(`Failed to generate pickup in Shiprocket: ${error.response?.data?.message || error.message}`);
        }

        const existingBox = await dimensionsModel.findOne({
            boxLength: data.boxLength,
            boxBreadth: data.boxBreadth,
            boxHeight: data.boxHeight
        });

        if (!existingBox) {
            const newBox = new dimensionsModel({
                boxLength,
                boxBreadth,
                boxHeight
            });
            await newBox.save();
        }

        // Update the Order in MongoDB with details from all Shiprocket responses
        const updateData = {
            length: data.boxLength,
            breadth: data.boxBreadth,
            height: data.boxHeight,
            weight: data.boxWeight,
            deliveryStatus: 'Assigned',
            status: 'Assigned',
            shiprocket_order_id: createOrderResponse.data.order_id,
            shiprocket_shipment_id: createOrderResponse.data.shipment_id,
            shiprocket_courier_id: assignCourierResponse.data.response.data.courier_company_id,
            shiprocket_awb_code: assignCourierResponse.data.response.data.awb_code,
            pickup_scheduled_date: generatePickupResponse.data.response.pickup_scheduled_date,
            pickup_token_number: generatePickupResponse.data.response.pickup_token_number
        };

        const updatedOrder = await OrderModel.findOneAndUpdate(
            { orderId: orderId },
            updateData,
            { new: true, session }
        ).populate('user');

        await session.commitTransaction();
        session.endSession();

        // Send shipping notification email
        // sendShippingNotificationEmail(updatedOrder, addressDetails, products);

        // Respond with all the Shiprocket API responses and the updated order details
        res.status(200).json({
            shiprocketOrderResponse: createOrderResponse.data,
            shiprocketCourierResponse: assignCourierResponse.data,
            shiprocketPickupResponse: generatePickupResponse.data,
            updatedOrderDetails: updatedOrder
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Failed to send order to Shiprocket or update database:", error.response?.data || error.message);
        res.status(500).send({ message: "Failed to process request", error: error.message });
    }
});

// async function sendShippingNotificationEmail(order, address) {
//     const transporter = nodemailer.createTransport({
//         service: 'gmail',
//         auth: {
//             user: process.env.SENDER_EMAIL_ID,
//             pass: process.env.SENDER_PASSWORD
//         }
//     });

//     const emailContent = `
//         <h2>Shipping Confirmation</h2>
//         <p>Dear ${address.firstName},</p>
//         <p>We're excited to let you know that your order <strong>${order.orderId}</strong> has been successfully processed and assigned to our courier partner.</p>
//         <p>You can view the complete details of your order and track its status by logging in to your account on DressCode eCommerce.</p>
//         <p><strong>Login here:</strong> <a href="https://ecom.dress-code.in/login" target="_blank">https://ecom.dress-code.in/login</a></p>
//         <p>Thank you for shopping with DressCode. We look forward to serving you again!</p>
//         <p>Best regards,<br>The DressCode Team</p>
//     `;

//     await transporter.sendMail({
//         from: process.env.SENDER_EMAIL_ID,
//         to: address.email,
//         subject: "Your Order is On the Way!",
//         html: emailContent
//     });

//     console.log("Shipping confirmation email sent successfully.");
// }

router.post('/manifests/generate', async (req, res) => {
    const reqData = req.body;

    try {
        const response = await axios.post(`https://apiv2.shiprocket.in/v1/external/manifests/generate`, reqData, {
            headers: {
                'Authorization': `Bearer ${process.env.SHIPROCKET_API_TOKEN}`
            }
        });
        // Process the response normally
        res.status(200).json(response.data);
    } catch (error) {
        console.error("Error in generating manifest: ", error.message);
        if (error.response) {
            res.status(error.response.status).send(
                error.response.data
            );
        } else if (error.request) {
            // The request was made but no response was received
            res.status(500).send({ message: "No response received", error: error.message });
        } else {
            // Something happened in setting up the request that triggered an Error
            res.status(500).send({ message: "Error setting up request", error: error.message });
        }
    }

});

router.post('/generate/label', async (req, res) => {
    const reqData = req.body;

    try {
        const response = await axios.post(`https://apiv2.shiprocket.in/v1/external/courier/generate/label`, reqData, {
            headers: {
                'Authorization': `Bearer ${process.env.SHIPROCKET_API_TOKEN}`
            }
        });

        // Process the response
        res.status(200).json(response.data);

    } catch (error) {
        console.error("Error in generating label: ", error.message);
        res.status(500).send({ message: "Failed to generate label", error: error.message });
    }
});

router.post('/print/invoice', async (req, res) => {
    const reqData = req.body;

    try {
        const response = await axios.post(`https://apiv2.shiprocket.in/v1/external/orders/print/invoice`, reqData, {
            headers: {
                'Authorization': `Bearer ${process.env.SHIPROCKET_API_TOKEN}`
            }
        });

        // Process the response
        res.status(200).json(response.data);

    } catch (error) {
        console.error("Error in printing invoice: ", error.message);
        res.status(500).send({ message: "Failed to print invoice", error: error.message });
    }
});

router.get('/track/awb/:awb_code', async (req, res) => {
    const { awb_code } = req.params;

    try {
        const response = await axios.get(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awb_code}`, {
            headers: {
                'Authorization': `Bearer ${process.env.SHIPROCKET_API_TOKEN}`
            }
        });

        // Process the response
        res.status(200).json(response.data);

    } catch (error) {
        console.error("Error in tracking with awb: ", error.message);
        res.status(500).send({ message: "Failed to track with awb", error: error.message });
    }
});

router.get('/:uploadedId/generateBarcodes', async (req, res) => {
    try {
        const { uploadedId } = req.params;

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

        // Fetch data from MongoDB
        // const data = await EliteModel.find({}).select('group category subCategory gender productType fit neckline pattern cuff sleeves material price variants -_id').lean();

        // Create a new workbook and add a worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Product Variants');

        // Define headers for the Excel file
        worksheet.columns = [
            { header: 'groupName', key: 'groupName', width: 20 },
            { header: 'categoryName', key: 'categoryName', width: 20 },
            { header: 'subCategoryName', key: 'subCategoryName', width: 20 },
            { header: 'gender', key: 'gender', width: 10 },
            { header: 'productType', key: 'productType', width: 15 },
            { header: 'fit', key: 'fit', width: 10 },
            { header: 'neckline', key: 'neckline', width: 15 },
            { header: 'pattern', key: 'pattern', width: 15 },
            { header: 'cuff', key: 'cuff', width: 10 },
            { header: 'sleeves', key: 'sleeves', width: 15 },
            { header: 'material', key: 'material', width: 15 },
            { header: 'price', key: 'price', width: 10 },
            { header: 'variantSize', key: 'variantSize', width: 12 },
            { header: 'variantColor', key: 'variantColor', width: 15 },
            { header: 'variantQuantity', key: 'variantQuantity', width: 18 },
            // { header: 'variantImage', key: 'variantImage', width: 30 },
            { header: 'styleCoat', key: 'styleCoat', width: 20 },
            { header: 'sku', key: 'sku', width: 30 },
            { header: 'Barcode', key: 'barcode', width: 30, height: 20 } // Placeholder for barcode images
        ];

        let barcodeIds = [];
        let rowIndex = 2;
        for (const item of productsDetails) {

            // Generate a barcode for each styleCoat
            const barcodeBuffer = await bwipjs.toBuffer({
                bcid: 'code128',    // Use Code 128 barcode type
                text: item.variants[0].variantSizes[0].styleCoat, // Use styleCoat as the barcode text
                scale: 3,           // 3x scaling factor
                height: 10,         // Bar height, in millimeters
                includetext: true,  // Include human-readable text
            });

            const barcodeImageId = workbook.addImage({
                buffer: barcodeBuffer,
                extension: 'png',
            });

            barcodeIds.push(barcodeImageId);

            const rowValues = {
                groupName: item.productDetails.group,
                categoryName: item.productDetails.category,
                subCategoryName: item.productDetails.subCategory,
                gender: item.productDetails.gender,
                productType: item.productDetails.productType,
                fit: item.productDetails.fit,
                neckline: item.productDetails.neckline ? item.productDetails.neckline : "N/A",
                pattern: item.productDetails.pattern ? item.productDetails.pattern : "N/A",
                cuff: item.productDetails.cuff ? item.productDetails.cuff : "N/A",
                sleeves: item.productDetails.sleeves,
                material: item.productDetails.material ? item.productDetails.material : "N/A",
                price: item.productDetails.price,
                variantSize: item.variants[0].variantSizes[0].size,
                variantColor: item.variants[0].color.name,
                variantQuantity: item.variants[0].variantSizes[0].quantityOfUpload,
                // variantImage: item.variants[0].variantSizes[0].quantityOfUpload,
                styleCoat: item.variants[0].variantSizes[0].styleCoat,
                sku: item.variants[0].variantSizes[0].sku,
            };
            worksheet.addRow(rowValues);
            worksheet.getRow(rowIndex).height = 50; // Set the row height to accommodate the barcode image
            // worksheet.addImage(barcodeImageId, `V${rowIndex}:V${rowIndex}`);

            rowIndex++;
        }

        // Now add barcode images using a separate loop
        let addBarcodesCount = rowIndex - 2; // Calculate how many barcodes we need to add
        for (let i = 0; i < addBarcodesCount; i++) {
            let barcodeRow = i + 2; // Adjust the row index to start from the first data row
            worksheet.addImage(barcodeIds[i], `R${barcodeRow}:R${barcodeRow}`);
        }

        // Set headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="ProductVariants.xlsx"');
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error(error);
        res.status(500).send('Failed to generate Excel file');
    }
});

router.patch('/return-order/:returnOrderId/update-refund-status', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { returnOrderId } = req.params;
    const { refund_payment_status } = req.body;

    try {
        // Find the return order by returnOrderId and update refund_payment_status
        const updatedReturnOrder = await ReturnOrdersModel.findOneAndUpdate(
            { returnOrderId: returnOrderId },
            { refund_payment_status: refund_payment_status },
            { new: true }  // Return the updated document
        ).populate('user');

        if (!updatedReturnOrder) {
            return res.status(404).json({ message: 'Return order not found' });
        }

        // Send refund status notification email
        sendRefundNotificationEmail(updatedReturnOrder);

        res.json({
            message: 'Refund payment status updated successfully',
            returnOrder: updatedReturnOrder
        });
    } catch (err) {
        console.error('Error updating refund payment status:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Function to send refund notification email
async function sendRefundNotificationEmail(returnOrder) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SENDER_EMAIL_ID,
                pass: process.env.SENDER_PASSWORD
            }
        });

        const emailContent = `
            <h2>Refund Payment Status Update</h2>
            <p>Dear ${returnOrder.user.name},</p>
            <p>We would like to inform you that the refund status for your return order with ID <strong>${returnOrder.returnOrderId}</strong> has been updated.</p>
            <p><strong>New Refund Status:</strong> ${returnOrder.refund_payment_status}</p>
            <p>To view more details, please log in to your account using the link below:</p>
            <p><a href="https://ecom.dress-code.in/login" target="_blank">https://ecom.dress-code.in/login</a></p>
            <p>If you have any questions or concerns, please contact our support team.</p>
            <br>
            <p>Thank you for choosing DressCode E-commerce!</p>
            <p>Best regards,</p>
            <p>The DressCode Team</p>
        `;

        await transporter.sendMail({
            from: process.env.SENDER_EMAIL_ID,
            to: returnOrder.user.email,
            subject: "Refund Payment Status Updated",
            html: emailContent
        });

        console.log("Refund notification email sent successfully.");
    } catch (error) {
        console.error("Failed to send refund notification email:", error.message);
    }
}

function formatDate(isoDateString) {
    const date = new Date(isoDateString);
    return date.toISOString().split('T')[0];
}

function calculateDiscount(TotalPriceAfterDiscount, discountPercentage) {
    // Calculate the original price before the discount
    const originalPrice = TotalPriceAfterDiscount / (1 - (discountPercentage / 100));

    // Calculate the discount amount
    const discountAmount = originalPrice - TotalPriceAfterDiscount;

    return discountAmount;
}


function calculateSubTotal(quantity, price, discountPercentage, deliveryCharges) {
    const totalAmount = quantity * price;
    const discountAmount = calculateDiscount(quantity, price, discountPercentage);
    return (totalAmount - discountAmount) + deliveryCharges;
}

function getFormattedDate() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based, so add 1
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}


router.get('/downloadInventory/:storeName', jwtHelperObj.verifyAccessToken, async (req, res) => {
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

        // Decode the storeName to handle URL encoding like %20 for spaces
        const storeName = decodeURIComponent(req.params.storeName.toUpperCase());

        // Fetch products from the 'Togs' collection where 'schoolName' matches 'storeName'
        const products = await TogsModel.find({ schoolName: storeName, isDeleted: false })
            .select('-reviews') // Exclude 'reviews' if not needed
            .lean(); // Use lean() for plain JavaScript objects

        if (!products || products.length === 0) {
            return res.status(404).send({ message: "No products found for the specified school name" });
        }

        // Define headers for the CSV file
        const csvStringifier = csvWriter({
            header: [
                { id: 'productId', title: 'productId' },
                { id: 'groupName', title: 'groupName' },
                { id: 'categoryName', title: 'categoryName' },
                { id: 'subCategoryName', title: 'subCategoryName' },
                { id: 'schoolName', title: 'schoolName' },
                { id: 'gender', title: 'gender' },
                { id: 'productType', title: 'productType' },
                { id: 'fit', title: 'fit' },
                { id: 'neckline', title: 'neckline' },
                { id: 'pattern', title: 'pattern' },
                { id: 'sleeves', title: 'sleeves' },
                { id: 'material', title: 'material' },
                { id: 'price', title: 'price' },
                { id: 'productDescription', title: 'productDescription' },
                { id: 'sizeChart', title: 'sizeChart' },
                { id: 'variantId', title: 'variantId' },
                { id: 'variantColor', title: 'variantColor' },
                { id: 'hexcode', title: 'hexcode' },
                { id: 'variantSize', title: 'variantSize' },
                { id: 'variantImages', title: 'variantImages' },
                { id: 'styleCoat', title: 'styleCoat' },
                { id: 'sku', title: 'sku' },
                { id: 'variantQuantity', title: 'variantQuantity' },
            ]
        });

        // Prepare records
        const records = [];

        for (const product of products) {
            const productDetails = product; // Since we fetched the products directly

            // Iterate over variants
            for (const variant of product.variants) {
                // Iterate over variantSizes
                for (const variantSize of variant.variantSizes) {
                    const row = {
                        productId: productDetails.productId,
                        groupName: productDetails.group,
                        categoryName: productDetails.category,
                        subCategoryName: productDetails.subCategory,
                        schoolName: productDetails.schoolName,
                        gender: productDetails.gender,
                        productType: productDetails.productType,
                        fit: productDetails.fit || "N/A",
                        neckline: productDetails.neckline || "N/A",
                        pattern: productDetails.pattern || "N/A",
                        sleeves: productDetails.sleeves || "N/A",
                        material: productDetails.material || "N/A",
                        price: productDetails.price,
                        productDescription: productDetails.productDescription || "N/A",
                        sizeChart: productDetails.sizeChart || "N/A",
                        variantId: variant.variantId,
                        variantColor: variant.color.name,
                        hexcode: variant.color.hexcode,
                        variantSize: variantSize.size,
                        variantImages: variant.imageUrls ? variant.imageUrls.join(', ') : "N/A",
                        styleCoat: variantSize.styleCoat,
                        sku: variantSize.sku,
                        variantQuantity: variantSize.quantity,
                    };
                    records.push(row);
                }
            }
        }

        if (records.length === 0) {
            return res.status(404).send({ message: "No variant data available for the specified school name" });
        }

        // Generate CSV content
        const header = csvStringifier.getHeaderString();
        const csvContent = csvStringifier.stringifyRecords(records);

        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="ProductVariants_${storeName}.csv"`);

        // Send the CSV content
        res.send(header + csvContent);

    } catch (error) {
        console.error("Error generating CSV file:", error);
        res.status(500).send('Failed to generate CSV file');
    }
});


module.exports = router;
