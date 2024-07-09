const express = require('express');
const UserService = require('../services/user_service');
const Constants = require('../utils/Constants/response_messages')
const JwtHelper = require('../utils/Helpers/jwt_helper')
const jwtHelperObj = new JwtHelper();
const router = express.Router()
const userServiceObj = new UserService();


router.post('/createUser', async (req, res, next) => {
    try {
        await userServiceObj.createUser(req.body);
        res.send({
            "status": 200,
            "message": Constants.SUCCESS,
        });
    } catch (err) {
        next(err);
    }
});

router.post('/login', async (req, res, next) => {
    try {
        const data = await userServiceObj.loginUser(req.body);
        res.send({
            "status": 200,
            "message": Constants.SUCCESS,
            "data": data
        })
    }
    catch (err) {
        next(err);
    }
})

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
    try {

        const { userId } = req.params


        const updates = req.body;

        // Call the updateUserDetails method from the UserService
        const updatedUserData = await userServiceObj.updateUserDetails(userId, updates);

        res.status(200).send({
            status: 200,
            message: Constants.SUCCESS,
            data: updatedUserData
        });
    } catch (err) {
        // Forward error handling to your error-handling middleware
        next(err);
    }
});

router.post('/:userId/addAddress', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const newAddress = req.body;

        const addresses = await userServiceObj.addAddress(userId, newAddress);
        res.status(200).send({ message: "Address added successfully", data: addresses });
    } catch (error) {
        console.error("Failed to add address:", error.message);
        res.status(500).send({ message: error.message });
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
    try {
        const { userId, addressId } = req.params;
        const addressUpdates = req.body;


        const updatedAddress = await userServiceObj.updateAddress(userId, addressId, addressUpdates);

        res.status(200).send({
            message: "Address updated successfully",
            data: updatedAddress
        });
    } catch (error) {
        console.error("Failed to update address:", error.message);
        res.status(500).send({ message: error.message });
    }
});

router.patch('/:userId/address/:addressId/setToDefault', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const { userId, addressId } = req.params;


        const result = await userServiceObj.setDefaultAddress(userId, addressId);

        res.status(200).send({
            message: result.message
        });
    } catch (error) {
        console.error("Failed to set default address:", error.message);
        res.status(500).send({ message: error.message });
    }
});

router.patch('/:userId/address/:addressId/removeAddress', jwtHelperObj.verifyAccessToken, async (req, res) => {
    try {
        const { userId, addressId } = req.params;


        const result = await userServiceObj.deleteAddress(userId, addressId);

        res.status(200).send({
            message: result.message
        });
    } catch (error) {
        console.error("Failed to mark address as deleted:", error.message);
        res.status(500).send({ message: error.message });
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

router.post('/:userId/addToCart', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { userId } = req.params;
    const cartItem = req.body;

    try {

        const addedCartItem = await userServiceObj.addToCart(userId, cartItem);

        res.status(201).send({
            message: "Product added to cart successfully",
            cartItem: addedCartItem
        });
    } catch (error) {
        console.error("Failed to add product to cart:", error.message);
        res.status(500).send({ message: error.message });
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

router.patch('/:userId/updateCartItemQuantity/:cartItemId', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { userId, cartItemId } = req.params;
    const { quantityNeedToChange } = req.body;

    try {
        const updatedCartItem = await userServiceObj.updateCartItemQuantity(userId, cartItemId, quantityNeedToChange);

        res.status(200).send({
            message: "Cart item quantity updated successfully",
            cartItem: updatedCartItem
        });
    } catch (error) {
        console.error("Failed to increase cart item quantity:", error.message);
        res.status(400).send({ message: error.message });
    }
});

// DELETE endpoint to remove a product from a user's cart
router.delete('/:userId/removeCartItem/:cartItemId', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { userId, cartItemId } = req.params;

    try {
        const result = await userServiceObj.removeCartItem(userId, cartItemId);
        res.status(200).send(result);
    } catch (error) {
        console.error("Failed to remove product from cart:", error.message);
        res.status(400).send({ message: error.message });
    }
});

router.post('/:userId/addToWishlist', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { userId } = req.params;
    const wishItem = req.body;

    try {

        const addedWishlistItem = await userServiceObj.addToWishlist(userId, wishItem);

        res.status(201).send({
            message: "Product added to wishlist successfully",
            wishlistItem: addedWishlistItem
        });
    } catch (error) {
        console.error("Failed to add product to wishlist:", error.message);
        res.status(400).send({ message: error.message }); // Assuming BadRequest for duplicates
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
    const { userId, wishlistItemId } = req.params;

    try {
        const result = await userServiceObj.removeWishlistItem(userId, wishlistItemId);

        res.status(200).send(result);
    } catch (error) {
        console.error("Failed to remove wishlist item:", error.message);
        res.status(400).send({ message: error.message });
    }
});

router.post('/:group/:productId/writeReview', jwtHelperObj.verifyAccessToken, async (req, res) => {
    const { group, productId } = req.params;
    const reviewData = req.body;

    try {
        const newReview = await userServiceObj.addProductReview(group, productId, reviewData);

        res.status(201).send({
            message: "Review added successfully",
            review: newReview
        });
    } catch (error) {
        console.error("Failed to add review:", error.message);
        res.status(500).send({ message: error.message });
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

module.exports = router;