const UserModel = require('../utils/Models/userModel');
const OrderModel = require('../utils/Models/orderModel');
const HealModel = require('../utils/Models/healModel');
const ShieldModel = require('../utils/Models/shieldModel');
const EliteModel = require('../utils/Models/eliteModel');
const TogsModel = require('../utils/Models/togsModel');
const SpiritsModel = require('../utils/Models/spiritsModel');
const WorkWearModel = require('../utils/Models/workWearModel');
const mongoose = require('mongoose');
const JWTHelper = require('../utils/Helpers/jwt_helper')
const bcrypt = require('bcrypt');

class OrderService {
    constructor() {
        this.UserModel = UserModel;
        this.jwtObject = new JWTHelper();
    }

    async createOrder(userId, orderDetails) {
        const { group, productId, color, size, quantityOrdered } = orderDetails;
        try {
            const modelMap = {
                "HEAL": HealModel,
                "SHIELD": ShieldModel,
                "ELITE": EliteModel,
                "TOGS": TogsModel,
                "SPIRIT": SpiritsModel,
                "WORK WEAR UNIFORMS": WorkWearModel
            };

            const ProductModel = modelMap[group];
            if (!ProductModel) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("Invalid product group");
            }

            // Find the product and the specific variant and size
            const product = await ProductModel.findOne({ "productId": productId, "variants.color": color });
            if (!product) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("Product or variant not found");
            }

            // Find the specific variant size and update the quantity
            const variant = product.variants.find(v => v.color === color);
            const variantSize = variant.variantSizes.find(v => v.size === size);
            if (!variantSize || variantSize.quantity < quantityOrdered) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("Insufficient stock for the variant");
            }

            // Decrease the stock quantity
            variantSize.quantity -= quantityOrdered;

            // Save the product with updated quantity
            await product.save();

            // Create and save the order
            const newOrder = new OrderModel({ user: userId,...orderDetails });
            const savedOrder = await newOrder.save();

            // Add the order ID to the user's orders list
            const user = await UserModel.findById(userId);
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('User not found');
            }
            user.orders.push(savedOrder._id);
            await user.save();

            return savedOrder;
        } catch (err) {
            console.error("Error creating order:", err.message);
            throw err;
        }
    }

    async createQuote(userId, orderDetails) {
        const { group, productId, color, size, quantityOrdered } = orderDetails;
        try {
            const modelMap = {
                "HEAL": HealModel,
                "SHIELD": ShieldModel,
                "ELITE": EliteModel,
                "TOGS": TogsModel,
                "SPIRIT": SpiritsModel,
                "WORK WEAR UNIFORMS": WorkWearModel
            };

            const ProductModel = modelMap[group];
            if (!ProductModel) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("Invalid product group");
            }

            // Find the product and the specific variant and size
            const product = await ProductModel.findOne({ "productId": productId, "variants.color": color });
            if (!product) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("Product or variant not found");
            }

            // Find the specific variant size and update the quantity
            const variant = product.variants.find(v => v.color === color);
            const variantSize = variant.variantSizes.find(v => v.size === size);
            if (!variantSize || variantSize.quantity < quantityOrdered) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("Insufficient stock for the variant");
            }

            // Decrease the stock quantity
            variantSize.quantity -= quantityOrdered;

            // Save the product with updated quantity
            await product.save();

            // Create and save the order
            const newOrder = new OrderModel({ user: userId,...orderDetails });
            const savedOrder = await newOrder.save();

            // Add the order ID to the user's orders list
            const user = await UserModel.findById(userId);
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('User not found');
            }
            user.orders.push(savedOrder._id);
            await user.save();

            return savedOrder;
        } catch (err) {
            console.error("Error creating order:", err.message);
            throw err;
        }
    }

}
module.exports = OrderService;