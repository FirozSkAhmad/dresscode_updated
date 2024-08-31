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
const OrderModel = require('../utils/Models/orderModel');
const QuoteModel = require('../utils/Models/quoteModel');
const DashboardUserModel = require('../utils/Models/dashboardUserModel');
const { createObjectCsvWriter } = require('csv-writer');
const ExcelJS = require('exceljs');
const bwipjs = require('bwip-js');
const { startSession } = require('mongoose');
const axios = require('axios');
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

// DELETE endpoint to logically delete a product
router.patch('/deleteProduct', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { group, productId } = req.body;

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

        // Update the product's isDeleted status within the transaction
        const updatedProduct = await ProductModel.findOneAndUpdate(
            { productId: productId },
            { $set: { isDeleted: true } },
            { new: true, session }  // Include the session to ensure this operation is part of the transaction
        );

        if (!updatedProduct) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).send({ message: "Product not found" });
        }

        // Commit the transaction after the update is successful
        await session.commitTransaction();
        session.endSession();  // Always end the session
        res.status(200).send({
            message: "Product deleted successfully",
            product: updatedProduct
        });
    } catch (error) {
        // Handle any errors that occur during the transaction
        await session.abortTransaction();
        session.endSession();
        console.error("Failed to delete product:", error);
        res.status(500).send({ message: "Failed to delete product", error: error.message });
    }
});

router.patch('/updateProductDetails', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { group, productId, color, size, newPrice, newQuantity } = req.body;

    const session = await mongoose.startSession(); // Start a new session for the transaction
    session.startTransaction(); // Begin the transaction

    try {
        const ProductModel = modelMap[group];
        if (!ProductModel) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).send({ message: "Invalid product group" });
        }

        // Find the product within the transaction
        const product = await ProductModel.findOne({ productId: productId }).session(session);
        if (!product) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).send({ message: "Product not found" });
        }

        // Update the price of the product
        product.price = newPrice;

        // Find and update the specific variant's quantity
        const variant = product.variants.find(v => v.color === color);
        if (!variant) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).send({ message: "Variant not found" });
        }

        const variantSize = variant.variantSizes.find(v => v.size === size);
        if (!variantSize) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).send({ message: "Variant size not found" });
        }

        // Update the quantity
        variantSize.quantity = newQuantity;

        // Save the updated product within the transaction
        await product.save({ session: session });

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        res.status(200).send({
            message: "Product details updated successfully",
            product: product  // Optionally return the updated product
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Failed to update product details:", error);
        res.status(500).send({ message: "Failed to update product details", error: error.message });
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

router.get('/getOders', jwtHelperObj.verifyAccessToken, async (req, res) => {
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
                dateOfOrder: order.dateOfOrder,
                deliveryCharges: order.deliveryCharges,
                discountPercentage: order.discountPercentage,
                TotalPriceAfterDiscount: order.TotalPriceAfterDiscount,
                estimatedDelivery: order.estimatedDelivery,
                shiprocket_order_id: order.shiprocket_order_id,
                shiprocket_shipment_id: order.shiprocket_shipment_id
            }
        });
    } catch (error) {
        console.error("Failed to retrieve order details:", error);
        res.status(500).send({ message: "Failed to retrieve order details", error: error.message });
    }
});

router.get('/getOders', jwtHelperObj.verifyAccessToken, async (req, res) => {
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

router.post('/assignToShipRocket/:orderId', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const session = await startSession();
    try {
        session.startTransaction();
        const { orderId } = req.params;
        const data = req.body;

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

            return {
                groupName: product.group,
                productId: product.productId,
                productName: `${productDoc.group.name}-${productDoc.productType.type}-${product.color.name}`,
                color: product.color,
                size: product.size,
                sku: variantSize.sku,
                styleCoat: variantSize.styleCoat,
                quantityOrdered: product.quantityOrdered,
                price: product.price,
                logoUrl: product.logoUrl,
                logoPosition: product.logoPosition,
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
                selling_price: item.price.toString()
            })),
            payment_method: "Prepaid",
            shipping_charges: order.deliveryCharges,
            total_discount: calculateDiscount(order.TotalPriceAfterDiscount, order.discountPercentage),
            sub_total: order.TotalPriceAfterDiscount,
            length: data.boxLength,
            breadth: data.boxBreadth,
            height: data.boxHeight,
            weight: data.boxWeight
        };

        // Configure Axios for the API request to Shiprocket
        const createOrderResponse = await axios.post(process.env.SHIPROCKET_API_URL + '/v1/external/orders/create/adhoc', requiredData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SHIPROCKET_API_TOKEN}`
            }
        });

        // Data for courier assignment
        const assignCourierData = {
            shipment_id: createOrderResponse.data.shipment_id,
            courier_id: data.courierId ? data.courierId : "24"
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

        // Update the Order in MongoDB with details from all Shiprocket responses
        const updateData = {
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
        console.error("Failed to send order to Shiprocket or update database:", error);
        res.status(500).send({ message: "Failed to process request", error: error.message });
    }
});


router.get('/download-excel', async (req, res) => {
    try {
        // Fetch data from MongoDB
        const data = await EliteModel.find({}).select('group category subCategory gender productType fit neckline pattern cuff sleeves material price variants -_id').lean();

        // Create a new workbook and add a worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Product Variants');

        // Define headers for the Excel file
        worksheet.columns = [
            { header: 'Group Name', key: 'groupName', width: 20 },
            { header: 'Group Image URL', key: 'groupImageUrl', width: 30 },
            { header: 'Category Name', key: 'categoryName', width: 20 },
            { header: 'Category Image URL', key: 'categoryImageUrl', width: 30 },
            { header: 'SubCategory Name', key: 'subCategoryName', width: 20 },
            { header: 'SubCategory Image URL', key: 'subCategoryImageUrl', width: 30 },
            { header: 'Gender', key: 'gender', width: 10 },
            { header: 'Product Type', key: 'productType', width: 15 },
            { header: 'Fit', key: 'fit', width: 10 },
            { header: 'Neckline', key: 'neckline', width: 15 },
            { header: 'Pattern', key: 'pattern', width: 15 },
            { header: 'Cuff', key: 'cuff', width: 10 },
            { header: 'Sleeves', key: 'sleeves', width: 15 },
            { header: 'Material', key: 'material', width: 15 },
            { header: 'Price', key: 'price', width: 10 },
            { header: 'Variant Size', key: 'variantSize', width: 12 },
            { header: 'Variant Color', key: 'variantColor', width: 15 },
            { header: 'Variant Quantity', key: 'variantQuantity', width: 18 },
            { header: 'Variant Image', key: 'variantImage', width: 30 },
            { header: 'Style Coat', key: 'styleCoat', width: 20 },
            { header: 'SKU', key: 'sku', width: 20 },
            { header: 'Barcode', key: 'barcode', width: 30 } // Placeholder for barcode images
        ];

        let rowIndex = 2;
        for (const item of data) {
            for (const variant of item.variants) {
                for (const size of variant.variantSizes) {
                    // Generate a barcode for each styleCoat
                    const barcodeBuffer = await bwipjs.toBuffer({
                        bcid: 'code128',    // Use Code 128 barcode type
                        text: size.styleCoat, // Use styleCoat as the barcode text
                        scale: 3,           // 3x scaling factor
                        height: 10,         // Bar height, in millimeters
                        includetext: true,  // Include human-readable text
                    });

                    const barcodeImageId = workbook.addImage({
                        buffer: barcodeBuffer,
                        extension: 'png',
                    });

                    const rowValues = {
                        groupName: item.group.name,
                        groupImageUrl: item.group.imageUrl,
                        categoryName: item.category.name,
                        categoryImageUrl: item.category.imageUrl,
                        subCategoryName: item.subCategory.name,
                        subCategoryImageUrl: item.subCategory.imageUrl,
                        gender: item.gender,
                        productType: item.productType.type,
                        fit: item.fit,
                        neckline: item.neckline,
                        pattern: item.pattern,
                        cuff: item.cuff,
                        sleeves: item.sleeves,
                        material: item.material,
                        price: item.price,
                        variantSize: size.size,
                        variantColor: variant.color.name,
                        variantQuantity: size.quantity,
                        variantImage: variant.imageUrls.join(", "),
                        styleCoat: size.styleCoat,
                        sku: size.sku
                    };

                    worksheet.addRow(rowValues);
                    worksheet.addImage(barcodeImageId, `V${rowIndex}:V${rowIndex}`);
                    rowIndex++;
                }
            }
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


module.exports = router;
