const express = require('express');
const UserService = require('../services/user_service');
const Constants = require('../utils/Constants/response_messages')
const JwtHelper = require('../utils/Helpers/jwt_helper')
const jwtHelperObj = new JwtHelper();
const router = express.Router()
const userServiceObj = new UserService();
const mongoose = require('mongoose');
const OrderModel = require('../utils/Models/orderModel');
const ReturnOrdersModel = require('../utils/Models/returnOrdersModel');
const HealModel = require('../utils/Models/healModel');
const EliteModel = require('../utils/Models/eliteModel');
const TogsModel = require('../utils/Models/togsModel');
const UserModel = require('../utils/Models/userModel');
const bcrypt = require('bcrypt');

const modelMap = {
    "HEAL": HealModel,
    "ELITE": EliteModel,
    "TOGS": TogsModel,
};

router.post('/createUser', async (req, res, next) => {
    const session = await mongoose.startSession(); // Start a new session for the transaction
    session.startTransaction(); // Start the transaction
    try {
        const { name, email, gender, phoneNumber, password } = req.body; // Extract userDetails from the request body

        // Check for an existing user by email or phone number
        const existingUser = await UserModel.findOne({
            $or: [
                { email: email.toLowerCase() },
                { phoneNumber: phoneNumber }
            ]
        });

        if (existingUser) {
            // If user exists, return an error
            return res.status(400).send("Email or Phone number already in use");
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Prepare the user payload
        const userPayload = {
            name,
            email: email.toLowerCase(),
            gender: gender.toUpperCase(),
            phoneNumber,
            password: hashedPassword
        };

        // Create the new user within the transaction
        const newUser = await UserModel.create([userPayload], { session });
        await session.commitTransaction(); // Commit the transaction if all operations are successful
        session.endSession(); // End the session

        // Send success response
        res.status(201).send({ message: 'User created successfully', user: newUser });
    } catch (error) {
        // Rollback the transaction in case of error
        await session.abortTransaction();
        session.endSession(); // End the session
        res.status(500).send({ message: 'Error creating user', error: error.message });
    }
});



router.post('/login', async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const data = await userServiceObj.loginUser(req.body, session, res);
        await session.commitTransaction();
        res.send({
            "status": 200,
            "message": Constants.SUCCESS,
            "data": data
        });
    } catch (err) {
        await session.abortTransaction();
        console.error("Transaction aborted due to an error:", err.message);
        next(err);
    } finally {
        session.endSession();
    }
});

router.post('/forgot-password', async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await userServiceObj.forgotPassword(req.body, session);
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
        const result = await userServiceObj.resetPassword(token, newPassword, session);
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


router.post('/refresh-token', async (req, res, next) => {
    const refreshToken = req.body.refreshToken;

    if (!refreshToken) {
        return next(new global.DATA.PLUGINS.httperrors.BadRequest("Refresh token is required"));
    }

    // Start a session for the transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const jwtObject = new JWTHelper();
        // Generate a new access token within the transaction
        const newAccessToken = await jwtObject.refreshAccessToken(refreshToken);

        // If there are any database operations to be performed, they can be included here

        // Commit the transaction
        await session.commitTransaction();

        // Send the new access token as a response
        res.json({ accessToken: newAccessToken });
    } catch (error) {
        // Abort the transaction in case of an error
        await session.abortTransaction();
        console.error("Transaction aborted due to an error:", error.message);
        next(error);
    } finally {
        // End the session
        session.endSession();
    }
});

// API to get all coupons for a given uid
router.get('/:userId/user-coupons', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { userId } = req.params;

    try {
        // Call the service function to get user coupons
        const coupons = await userServiceObj.getUserCoupons(userId);

        res.status(200).json({
            message: 'Coupons retrieved successfully',
            coupons
        });
    } catch (error) {
        console.error('Error fetching coupons for user:', error.message);
        res.status(404).json({ message: error.message });
    }
});

// API to get all active (pending) coupons for a given uid
router.get('/:userId/user-active-coupons', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { userId } = req.params;
    const { group, productId } = req.query; // optional filtering 

    // Validate required parameters
    if (!group || !productId) {
        return res.status(400).json({ message: 'Group and productId are required' });
    }

    try {
        // Call the service function to get user active coupons
        const activeCoupons = await userServiceObj.getUserActiveCoupons(userId, group, productId);

        res.status(200).json({
            message: 'Active coupons retrieved successfully',
            coupons: activeCoupons
        });
    } catch (error) {
        console.error('Error fetching active coupons for user:', error.message);
        res.status(404).json({ message: error.message });
    }
});

// API to get all active (pending) coupons for a given uid with multiple filters
router.post('/:userId/cart-active-coupons', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { userId } = req.params;
    const filters = req.body; // Array of objects with { group, productId }

    // Validate the request body
    if (!Array.isArray(filters) || filters.length === 0) {
        return res.status(400).json({ message: 'Filters are required and must be an array of objects' });
    }

    try {
        // Call the service function to get categorized user active coupons
        const coupons = await userServiceObj.getCartActiveCoupons(userId, filters);

        res.status(200).json({
            message: 'Active coupons retrieved successfully',
            coupons
        });
    } catch (error) {
        console.error('Error fetching active coupons for user:', error.message);
        res.status(404).json({ message: error.message });
    }
});


// GET endpoint to retrieve specific details for a user
router.get('/:userId/getUserDetails', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { userId } = req.params;

    try {
        const userDetails = await userServiceObj.getUserDetails(userId);

        res.status(200).send({
            message: "User details retrieved successfully",
            userDetails: userDetails
        });
    } catch (error) {
        console.error("Failed to retrieve user details:", error.message);
        res.status(400).send({ message: error.message });
    }
});

router.patch('/:userId/updateUserDetails', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { userId } = req.params;
        const updates = req.body;

        // Pass the session to updateUserDetails method
        const updatedUserData = await userServiceObj.updateUserDetails(userId, updates, session);

        await session.commitTransaction();
        res.status(200).send({
            status: 200,
            message: Constants.SUCCESS,
            data: updatedUserData
        });
    } catch (err) {
        await session.abortTransaction();
        console.error("Transaction aborted due to an error:", err.message);
        next(err);
    } finally {
        session.endSession();
    }
});

router.post('/:userId/addAddress', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { userId } = req.params;
        const newAddress = req.body;

        const addedAddress = await userServiceObj.addAddress(userId, newAddress, session);
        await session.commitTransaction();
        res.status(200).send({ message: "Address added successfully", data: addedAddress });
    } catch (error) {
        await session.abortTransaction();
        console.error("Failed to add address:", error.message);
        res.status(500).send({ message: error.message });
    } finally {
        session.endSession();
    }
});

router.get('/:userId/addresses/active', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const { userId } = req.params;


        const addresses = await userServiceObj.getActiveAddresses(userId);

        res.status(200).send({
            message: "Active addresses retrieved successfully",
            data: addresses
        });
    } catch (error) {
        console.error("Failed to retrieve active addresses:", error.message);
        res.status(500).send({ message: error.message });
    }
});

router.patch('/:userId/address/:addressId/updateAddress', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { userId, addressId } = req.params;
        const addressUpdates = req.body;

        const updatedAddress = await userServiceObj.updateAddress(userId, addressId, addressUpdates, session);
        await session.commitTransaction();
        res.status(200).send({
            message: "Address updated successfully",
            data: updatedAddress
        });
    } catch (error) {
        await session.abortTransaction();
        console.error("Failed to update address:", error.message);
        res.status(500).send({ message: error.message });
    } finally {
        session.endSession();
    }
});

router.patch('/:userId/address/:addressId/setToDefault', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { userId, addressId } = req.params;

        const result = await userServiceObj.setDefaultAddress(userId, addressId, session);
        await session.commitTransaction();
        res.status(200).send({
            message: result.message
        });
    } catch (error) {
        await session.abortTransaction();
        console.error("Failed to set default address:", error.message);
        res.status(500).send({ message: error.message });
    } finally {
        session.endSession();
    }
});

router.patch('/:userId/address/:addressId/removeAddress', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { userId, addressId } = req.params;

        const result = await userServiceObj.deleteAddress(userId, addressId, session);
        await session.commitTransaction();
        res.status(200).send({
            message: result.message
        });
    } catch (error) {
        await session.abortTransaction();
        console.error("Failed to mark address as deleted:", error.message);
        res.status(500).send({ message: error.message });
    } finally {
        session.endSession();
    }
});

router.get('/:userId/getOrders', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const { userId } = req.params;

        const orders = await userServiceObj.getUserOrdersWithProductDetails(userId);

        if (orders.length === 0) {
            return res.status(404).send({ message: 'No orders found for this user.' });
        }

        res.status(200).send({
            message: "Orders retrieved successfully",
            orders: orders
        });
    } catch (error) {
        console.error("Failed to retrieve orders:", error.message);
        res.status(500).send({ message: error.message });
    }
});

router.get('/:userId/getReturnOrders', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const { userId } = req.params;

        const returnOrders = await userServiceObj.getUserReturnOrdersWithProductDetails(userId);

        if (returnOrders.length === 0) {
            return res.status(404).send({ message: 'No return orders found for this user.' });
        }

        res.status(200).send({
            message: "Retrun Orders retrieved successfully",
            returnOrders: returnOrders
        });
    } catch (error) {
        console.error("Failed to retrieve orders:", error.message);
        res.status(500).send({ message: error.message });
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

router.get('/:userId/getQuotes', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const { userId } = req.params;

        const quotes = await userServiceObj.getUserQuotesWithProductDetails(userId);

        if (quotes.length === 0) {
            return res.status(404).send({ message: 'No quotes found for this user.' });
        }

        res.status(200).send({
            message: "Quotes retrieved successfully",
            quotes: quotes
        });
    } catch (error) {
        console.error("Failed to retrieve quotes:", error.message);
        res.status(500).send({ message: error.message });
    }
});

// router.post('/:userId/addToCart', jwtHelperObj.verifyAccessToken, async (req, res) => {
//     const session = await mongoose.startSession();
//     session.startTransaction();
//     try {
//         const { userId } = req.params;
//         const cartItem = req.body;

//         const addedCartItem = await userServiceObj.addToCart(userId, cartItem, session);
//         await session.commitTransaction();
//         res.status(201).send({
//             message: "Product added to cart successfully",
//             cartItem: addedCartItem
//         });
//     } catch (error) {
//         await session.abortTransaction();
//         console.error("Failed to add product to cart:", error.message);
//         res.status(500).send({ message: error.message });
//     } finally {
//         session.endSession();
//     }
// });

router.post('/:userId/addProductToCart', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { userId } = req.params;
        const cartItem = req.body;

        const addedCartItem = await userServiceObj.addProductToCart(userId, cartItem, session);
        await session.commitTransaction();
        res.status(201).send({
            message: "Product added to cart successfully",
            cartItem: addedCartItem
        });
    } catch (error) {
        console.error("Failed to add product to cart:", error.message);
        await session.abortTransaction();
        res.status(500).send({ message: error.message });
    } finally {
        session.endSession();
    }
});

router.get('/:userId/getCart', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { userId } = req.params;

    try {
        const cartWithDetails = await userServiceObj.getUserCartWithProductDetails(userId);

        res.status(200).send({
            message: "Cart items retrieved successfully",
            cartItems: cartWithDetails
        });
    } catch (error) {
        console.error("Failed to retrieve cart items with product details:", error.message);
        res.status(500).send({ message: error.message });
    }
});

router.get('/checkProductQuantity', async (req, res) => {//, jwtHelperObj.verifyAccessToken
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const productDetails = req.query;

        await userServiceObj.checkProductQuantity(productDetails, session);
        await session.commitTransaction();
        res.status(200).send({
            message: "sufficient stock"
        });
    } catch (error) {
        await session.abortTransaction();
        console.error("Failed to increase cart item quantity:", error.message);
        res.status(400).send({ message: error.message });
    } finally {
        session.endSession();
    }
});

router.patch('/:userId/updateCartItemQuantity/:cartItemId', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { userId, cartItemId } = req.params;
        const { quantityNeedToChange } = req.body;

        const updatedCartItem = await userServiceObj.updateCartItemQuantity(userId, cartItemId, quantityNeedToChange, session);
        await session.commitTransaction();
        res.status(200).send({
            message: "Cart item quantity updated successfully",
            cartItem: updatedCartItem
        });
    } catch (error) {
        await session.abortTransaction();
        console.error("Failed to increase cart item quantity:", error.message);
        res.status(400).send({ message: error.message });
    } finally {
        session.endSession();
    }
});

router.patch('/:userId/updateCartItemCheck/:cartItemId', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { userId, cartItemId } = req.params;
        const { checked } = req.body;

        const updatedCartItem = await userServiceObj.updateCartItemCheck(userId, cartItemId, checked, session);
        await session.commitTransaction();
        res.status(200).send({
            message: "Cart item check updated successfully",
            cartItem: updatedCartItem
        });
    } catch (error) {
        await session.abortTransaction();
        console.error("Failed to update cart item check:", error.message);
        res.status(400).send({ message: error.message });
    } finally {
        session.endSession();
    }
});

// DELETE endpoint to remove a product from a user's cart
router.delete('/:userId/removeCartItem/:cartItemId', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { userId, cartItemId } = req.params;

        const result = await userServiceObj.removeCartItem(userId, cartItemId, session);
        await session.commitTransaction();
        res.status(200).send(result);
    } catch (error) {
        await session.abortTransaction();
        console.error("Failed to remove product from cart:", error.message);
        res.status(400).send({ message: error.message });
    } finally {
        session.endSession();
    }
});

router.delete('/:userId/removeCartItems', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { userId } = req.params;
        const { cartItemIds } = req.body; // Array of cart item IDs

        if (!cartItemIds || cartItemIds.length === 0) {
            return res.status(400).send({ message: "No cart items provided for deletion." });
        }

        for (const cartItemId of cartItemIds) {
            await userServiceObj.removeCartItem(userId, cartItemId, session);
        }

        await session.commitTransaction();
        res.status(200).send("removed necessary cart items successfully");
    } catch (error) {
        await session.abortTransaction();
        console.error("Failed to remove products from cart:", error.message);
        res.status(400).send({ message: error.message });
    } finally {
        session.endSession();
    }
});


router.post('/:userId/addToWishlist', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { userId } = req.params;
        const wishItem = req.body;

        const addedWishlistItem = await userServiceObj.addToWishlist(userId, wishItem, session);
        await session.commitTransaction();
        res.status(201).send({
            message: "Product added to wishlist successfully",
            wishlistItem: addedWishlistItem
        });
    } catch (error) {
        await session.abortTransaction();
        console.error("Failed to add product to wishlist:", error.message);
        res.status(400).send({ message: error.message });
    } finally {
        session.endSession();
    }
});

router.get('/:userId/getWishlist', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { userId } = req.params;

    try {
        const wishlistWithDetails = await userServiceObj.getUserWishlistWithProductDetails(userId);

        res.status(200).send({
            message: "Wishlist items retrieved successfully",
            Wishlist: wishlistWithDetails
        });
    } catch (error) {
        console.error("Failed to retrieve wishlist items with product details:", error.message);
        res.status(500).send({ message: error.message });
    }
});

// DELETE endpoint to remove a product from a user's wishlist
router.delete('/:userId/removeWishlistItem/:wishlistItemId', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { userId, wishlistItemId } = req.params;

        const result = await userServiceObj.removeWishlistItem(userId, wishlistItemId, session);
        await session.commitTransaction();
        res.status(200).send(result);
    } catch (error) {
        await session.abortTransaction();
        console.error("Failed to remove wishlist item:", error.message);
        res.status(400).send({ message: error.message });
    } finally {
        session.endSession();
    }
});

router.post('/:group/:productId/writeReview', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { group, productId } = req.params;
        const reviewData = req.body;

        const newReview = await userServiceObj.addProductReview(group, productId, reviewData, session);
        await session.commitTransaction();
        res.status(201).send({
            message: "Review added successfully",
            review: newReview
        });
    } catch (error) {
        await session.abortTransaction();
        console.error("Failed to add review:", error.message);
        res.status(500).send({ message: error.message });
    } finally {
        session.endSession();
    }
});

router.get('/:group/:productId/getProductReviews', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { group, productId } = req.params;

    try {
        const reviews = await userServiceObj.getProductReviews(group, productId);
        res.status(200).send({
            message: "Reviews retrieved successfully",
            reviews: reviews
        });
    } catch (error) {
        console.error("Failed to retrieve reviews:", error.message);
        res.status(500).send({ message: error.message });
    }
});

router.patch('/:userId/cancelOrder/:orderId', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const { userId, orderId } = req.params;
        const aubUserId = req.aud.split(":")[0]; // Middleware decodes JWT and adds it to req
        // Check if the user is authorized to cancel this order
        if (userId !== aubUserId) {
            return res.status(401).json({
                status: 401,
                message: "Unauthorized access."
            });
        }

        const result = await userServiceObj.cancelOrder(orderId);

        if (result.success) {
            res.status(200).send({
                message: "Order canceled successfully",
                order: result.order
            });
        } else {
            res.status(result.statusCode).send({ message: result.message });
        }
    } catch (error) {
        console.error("Error in canceling the order:", error.message);
        res.status(500).send({ message: "Failed to cancel order", error: error.message });
    }
});

router.get('/:userId/getCanceledOrders', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const { userId } = req.params;

        const canceledOrders = await userServiceObj.getUserCanceledOrdersWithProductDetails(userId);

        if (canceledOrders.length === 0) {
            return res.status(404).send({ message: 'No canceled orders found for this user.' });
        }

        res.status(200).send({
            message: "Canceled orders retrieved successfully",
            orders: canceledOrders
        });
    } catch (error) {
        console.error("Failed to retrieve canceled orders:", error.message);
        res.status(500).send({ message: error.message });
    }
});


router.post('/order/return', jwtHelperObj.verifyAccessToken, async (req, res) => {

    const { orderId, products, TotalAmount, TotalDiscountAmount } = req.body

    const session = await startSession();
    try {
        session.startTransaction();
        const order = await OrderModel.findOne({ orderId }).populate('user');
        if (!order) {
            return res.status(404).send({ message: "Order not found" });
        }

        if (order.deliveryStatus !== "Delivered") {
            return res.status(400).send({ message: "Order is not delivered yet" });
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

        let totalQuantityOrdered = order.products.reduce((total, product) => {
            return total + product.quantityOrdered;
        }, 0);

        let totalReturnQuantity = 0

        const productsPromises = products.map(async (product) => {
            const ProductModel = modelMap[product.group];
            const productDoc = await ProductModel.findOne({ productId: product.productId });
            const variant = productDoc.variants.find(v => v.color.name === product.color.name);
            const variantSize = variant.variantSizes.find(v => v.size === product.size);
            const unitDiscount = (product.discountAmount / product.quantityOrdered)

            totalReturnQuantity += product.quantityOrdered;

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
                name: product.name,
                logoPosition: product.logoPosition,
                unitDiscount: unitDiscount,
                imageUrl: product.imgUrl
            };
        });

        const returnWeight = order.weight / totalQuantityOrdered

        // Resolve all promises
        const allProducts = await Promise.all(productsPromises);

        const requiredData = {
            order_id: orderId,
            order_date: formatDate(order.dateOfOrder),
            channel_id: "5385351",
            pickup_customer_name: addressDetails.firstName,
            pickup_address: addressDetails.address,
            pickup_city: addressDetails.city,
            pickup_state: addressDetails.state,
            pickup_country: addressDetails.state,
            pickup_pincode: addressDetails.state,
            pickup_email: addressDetails.state,
            pickup_phone: addressDetails.state,
            pickup_isd_code: "91",
            shipping_customer_name: "Shashi",
            shipping_address: "DressCode ,  G Anupamanandh Vijay Kumar Building, Opp RVR School of Photography, Annapurna Studio Lane,  Rd No :2, LV Prasad Marg, Jubilee Hills .",
            shipping_city: "Hyderabad",
            shipping_country: "India",
            shipping_pincode: 500033,
            shipping_state: "Telangana",
            shipping_email: "info@dress-code.in",
            shipping_isd_code: "91",
            shipping_phone: 7036436370,
            order_items: allProducts.map(item => ({
                name: item.productName,
                qc_enable: true,
                qc_product_name: productName,
                sku: item.styleCoat,
                units: item.quantityOrdered,
                selling_price: item.price.toString(),
                discount: item.unitDiscount.toString(),
                qc_brand: "DreesCode",
                qc_product_image: item.imageUrl
            })),
            payment_method: "Prepaid",
            total_discount: TotalDiscountAmount,
            sub_total: TotalAmount,
            length: order.length,
            breadth: order.breadth,
            height: order.height,
            weight: returnWeight
        };

        // Call Shiprocket cancel API
        const createReturnResponse = await axios.post(`https://apiv2.shiprocket.in/v1/external/orders/create/return`, req.body, {
            headers: {
                'Authorization': `Bearer ${process.env.SHIPROCKET_API_TOKEN}`
            }
        });

        const assignCourierData = {
            shipment_id: createReturnResponse.data.shipment_id,
            is_return: 1
        };

        const assignCourierResponse = await axios.post(`https://apiv2.shiprocket.in/v1/external/orders/create/return`, assignCourierData, {
            headers: {
                'Authorization': `Bearer ${process.env.SHIPROCKET_API_TOKEN}`
            }
        });

        const productIdsToUpdate = products.map(product => product._id);


        const updatedOrder = await OrderModel.updateMany(
            {
                _id: orderId,
                'products._id': { $in: productIdsToUpdate }
            },
            {
                $set: { 'products.$[elem].return': true, 'products.$[elem].return_status': 'Pending' }
            },
            {
                arrayFilters: [{ 'elem._id': { $in: productIdsToUpdate } }],
                multi: true  // To update multiple matching products
            }
        )
        console.log("Products updated successfully:", updatedOrder);

        // Create and save the return order
        const newReturnOrder = new ReturnOrdersModel({
            paymentId: order.paymentId,
            user: order.user._id,
            address: order.address,
            products: products,
            deliveryCharges,
            TotalAmount,
            TotalDiscountAmount,
            TotalPriceAfterDiscount
        });

        const savedReturnOrder = await newReturnOrder.save({ session });

        // Update the user's orders list
        const existingUser = await UserModel.findById(order.user._id).session(session);
        if (!existingUser) {
            throw new global.DATA.PLUGINS.httperrors.BadRequest('User not found');
        }
        existingUser.returnOrders.push(savedReturnOrder._id);
        await existingUser.save({ session });

        // Respond with the Shiprocket API response
        res.status(200).json({
            message: "Order canceled successfully"
        });

    } catch (error) {
        console.error("Error in canceling the order: ", error.message);
        res.status(500).send({ message: "Failed to cancel order", error: error.message });
    }
});

module.exports = router;