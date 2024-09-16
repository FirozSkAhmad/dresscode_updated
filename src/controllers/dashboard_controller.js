const express = require('express');
const Constants = require('../utils/Constants/response_messages')
const JwtHelper = require('../utils/Helpers/jwt_helper')
const jwtHelperObj = new JwtHelper();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const router = express.Router()
const UploadedHistoryModel = require('../utils/Models/uploadedHistoryModel');
const HealModel = require('../utils/Models/healModel');
const ShieldModel = require('../utils/Models/shieldModel');
const EliteModel = require('../utils/Models/eliteModel');
const TogsModel = require('../utils/Models/togsModel');
const SpiritsModel = require('../utils/Models/spiritsModel');
const WorkWearModel = require('../utils/Models/workWearModel');
const ReturnOrdersModel = require('../utils/Models/returnOrdersModel');
const OrderModel = require('../utils/Models/orderModel');
const QuoteModel = require('../utils/Models/quoteModel');
const dimensionsModel = require('../utils/Models/dimensionsModel');
const DashboardUserModel = require('../utils/Models/dashboardUserModel');
const { createObjectCsvWriter } = require('csv-writer');
const ExcelJS = require('exceljs');
const bwipjs = require('bwip-js');
const axios = require('axios');
const { startSession } = require('mongoose');
require('dotenv').config();  // Make sure to require dotenv if you need access to your .env variables

const modelMap = {
    "HEAL": HealModel,
    "SHIELD": ShieldModel,
    "ELITE": EliteModel,
    "TOGS": TogsModel,
    "SPIRIT": SpiritsModel,
    "WORK WEAR UNIFORMS": WorkWearModel
};

router.post('/createDashboardUser', async (req, res) => {
    const session = await mongoose.startSession(); // Start a new session for the transaction
    session.startTransaction(); // Start the transaction
    try {
        const { name, email, phoneNumber, password, roleType } = req.body;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userPayload = {
            name,
            email: email.toLowerCase(), // Ensure the email is stored in lowercase
            phoneNumber,
            password: hashedPassword,
            roleType
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

        const data = {
            accessToken: accessToken,
            userId: userData._id,
            name: userData.name,
            roleType: userData.roleType
        };

        res.send({ status: 200, message: "Success", data: data });
    } catch (err) {
        console.error("Error in loginUser: ", err.message);
        next(err); // Pass to the default error handler
    }
});

// GET endpoint to retrieve upload history summaries
router.get('/uploadHistories', jwtHelperObj.verifyAccessToken, async (req, res) => {
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
router.get('/getOverview', async (req, res) => {
    try {
        // Fetch all upload histories for stock overview
        const uploadHistories = await UploadedHistoryModel.find({});

        // Initialize a stock object to hold the group-wise and total stock quantity, amount, and order counts
        let stock = {};
        let totalAmount = 0;
        let totalQuantity = 0;
        let totalOrders = 0;

        // Loop through each upload history and calculate group-wise stock quantity and amount
        for (const history of uploadHistories) {
            const productsDetails = await Promise.all(history.products.map(async (product) => {
                const ProductModel = modelMap[product.group];
                if (!ProductModel) {
                    throw new Error(`No model found for group: ${product.group}`);
                }
                // Retrieve the product details based on productId
                const productDetails = await ProductModel.findOne({ productId: product.productId })
                    .select('price');  // Only select the price field

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
                        const amount = quantity * productDetails.price;  // Multiply quantity by price

                        groupTotalAmount += amount;
                        groupTotalQuantity += quantity;
                    });
                });

                // Update the stock for the group (amount, quantity)
                if (!stock[product.group]) {
                    stock[product.group] = { amount: 0, quantity: 0, orders: 0 };
                }
                stock[product.group].amount += groupTotalAmount;
                stock[product.group].quantity += groupTotalQuantity;

                totalAmount += groupTotalAmount;  // Add to total stock amount
                totalQuantity += groupTotalQuantity;  // Add to total stock quantity

                return { ...product.toObject(), productDetails };
            }));
        }

        // Fetch all orders for order overview
        const orders = await OrderModel.find({});

        // Loop through each order and count orders by group
        orders.forEach(order => {
            totalOrders += 1;  // Increment total orders count

            order.products.forEach(product => {
                if (!stock[product.group]) {
                    stock[product.group] = { amount: 0, quantity: 0, orders: 0 };
                }
                stock[product.group].orders += 1;  // Increment the order count for the group
            });
        });

        // Include the total amount, quantity, and orders in the stock object
        stock.total = { amount: totalAmount, quantity: totalQuantity, orders: totalOrders };

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
                    quantity: vs.quantity
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
        // Find orders where deliveryStatus is not "Canceled"
        const orders = await OrderModel.find({ deliveryStatus: { $ne: 'Canceled' } }, 'orderId dateOfOrder status -_id').exec();

        res.status(200).send({
            message: "Orders retrieved successfully",
            orders: orders
        });
    } catch (error) {
        console.error("Failed to retrieve orders:", error);
        res.status(500).send({ message: "Failed to retrieve orders", error: error.message });
    }
});

router.get('/getCancledOrders', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        // Find orders where deliveryStatus is "Canceled"
        const orders = await OrderModel.find({ deliveryStatus: 'Canceled' }, 'orderId dateOfOrder status -_id').exec();

        res.status(200).send({
            message: "Cancled Orders retrieved successfully",
            canceled_orders: orders
        });
    } catch (error) {
        console.error("Failed to retrieve orders:", error);
        res.status(500).send({ message: "Failed to retrieve orders", error: error.message });
    }
});

router.get('/getReturnOders', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const returnOrders = await ReturnOrdersModel.find({}, 'returnOrderId dateOfOrder status -_id').exec();
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
                logoPosition: product.logoPosition,
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
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    gender: user.gender,
                    phoneNumber: user.phoneNumber
                },
                addressDetails: addressDetails,
                deliveryStatus: order.deliveryStatus,
                status: order.status,
                dateOfOrder: order.dateOfOrder,
                deliveryCharges: order.deliveryCharges,
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

router.get('/getOders', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        // Find orders where deliveryStatus is not "Canceled"
        const orders = await OrderModel.find({ deliveryStatus: { $ne: 'Canceled' } }, 'orderId dateOfOrder status -_id').exec();

        res.status(200).send({
            message: "Orders retrieved successfully",
            orders: orders
        });
    } catch (error) {
        console.error("Failed to retrieve orders:", error);
        res.status(500).send({ message: "Failed to retrieve orders", error: error.message });
    }
});

router.get('/getQuotes', jwtHelperObj.verifyAccessToken, async (req, res) => {
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
            const unitDiscount = (product.discountAmount / product.quantityOrdered)

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

        console.log(requiredData)

        // Configure Axios for the API request to Shiprocket
        const createOrderResponse = await axios.post(process.env.SHIPROCKET_API_URL + '/v1/external/orders/create/adhoc', requiredData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SHIPROCKET_API_TOKEN}`
            }
        });

        console.log(createOrderResponse)

        // Data for courier assignment
        const assignCourierData = {
            shipment_id: createOrderResponse.data.shipment_id,
            // courier_id: data.courierId ? data.courierId : "24"
        };

        // Second API call to assign a courier
        const assignCourierResponse = await axios.post(process.env.SHIPROCKET_API_URL + '/v1/external/courier/assign/awb', assignCourierData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SHIPROCKET_API_TOKEN}`
            }
        });

        // Prepare data for generating a pickup
        const pickupData = {
            shipment_id: [createOrderResponse.data.shipment_id]
        };

        // Third API call to generate a pickup
        const generatePickupResponse = await axios.post(process.env.SHIPROCKET_API_URL + '/v1/external/courier/generate/pickup', pickupData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SHIPROCKET_API_TOKEN}`
            }
        });

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
        );

        await session.commitTransaction();
        session.endSession();

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
        console.error("Failed to send order to Shiprocket or update database:", error.message);
        res.status(500).send({ message: "Failed to process request", error: error.message });
    }
});

router.post('/manifests/generate', async (req, res) => {
    const reqData = req.body;

    const authorizationHeader = req.headers['authorization'];

    if (!authorizationHeader) {
        return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authorizationHeader.split(' ')[1]; // Assuming the token is prefixed by 'Bearer'

    try {
        const response = await axios.post(`https://apiv2.shiprocket.in/v1/external/manifests/generate`, reqData, {
            headers: {
                'Authorization': `Bearer ${token}`
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

    const authorizationHeader = req.headers['authorization'];

    if (!authorizationHeader) {
        return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authorizationHeader.split(' ')[1]; // Assuming the token is prefixed by 'Bearer'

    try {
        const response = await axios.post(`https://apiv2.shiprocket.in/v1/external/courier/generate/label`, reqData, {
            headers: {
                'Authorization': `Bearer ${token}`
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

    const authorizationHeader = req.headers['authorization'];

    if (!authorizationHeader) {
        return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authorizationHeader.split(' ')[1]; // Assuming the token is prefixed by 'Bearer'

    try {
        const response = await axios.post(`https://apiv2.shiprocket.in/v1/external/orders/print/invoice`, reqData, {
            headers: {
                'Authorization': `Bearer ${token}`
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

    const authorizationHeader = req.headers['authorization'];

    if (!authorizationHeader) {
        return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authorizationHeader.split(' ')[1]; // Assuming the token is prefixed by 'Bearer'

    try {
        const response = await axios.get(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awb_code}`, {
            headers: {
                'Authorization': `Bearer ${token}`
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
        );

        if (!updatedReturnOrder) {
            return res.status(404).json({ message: 'Return order not found' });
        }

        res.json({
            message: 'Refund payment status updated successfully',
            returnOrder: updatedReturnOrder
        });
    } catch (err) {
        console.error('Error updating refund payment status:', err);
        res.status(500).json({ message: 'Internal server error' });
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
        );

        if (!updatedReturnOrder) {
            return res.status(404).json({ message: 'Return order not found' });
        }

        res.json({
            message: 'Refund payment status updated successfully',
            returnOrder: updatedReturnOrder
        });
    } catch (err) {
        console.error('Error updating refund payment status:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

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


module.exports = router;
