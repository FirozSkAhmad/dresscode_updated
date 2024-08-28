const UserModel = require('../utils/Models/userModel');
const OrderModel = require('../utils/Models/orderModel');
const QuoteModel = require('../utils/Models/quoteModel');
const HealModel = require('../utils/Models/healModel');
const ShieldModel = require('../utils/Models/shieldModel');
const EliteModel = require('../utils/Models/eliteModel');
const TogsModel = require('../utils/Models/togsModel');
const SpiritsModel = require('../utils/Models/spiritsModel');
const WorkWearModel = require('../utils/Models/workWearModel');
const mongoose = require('mongoose');
const JWTHelper = require('../utils/Helpers/jwt_helper')
const bcrypt = require('bcrypt');
const colorCodes = require('../utils/Helpers/data');

class OrderService {
    constructor() {
        this.UserModel = UserModel;
        this.jwtObject = new JWTHelper();
    }

    async createOrder(userId, addressId, orderDetails, session) {
        try {
            const { paymentId, products: orderProducts, deliveryCharges, discountPercentage, TotalPriceAfterDiscount } = orderDetails;

            // Mapping from group to Product Model
            const modelMap = {
                "HEAL": HealModel,
                "SHIELD": ShieldModel,
                "ELITE": EliteModel,
                "TOGS": TogsModel,
                "SPIRIT": SpiritsModel,
                "WORK WEAR UNIFORMS": WorkWearModel
            };

            // Process each product in the order
            const productsProcessed = await Promise.all(orderProducts.map(async (product) => {
                const { group, productId, color, size, quantityOrdered } = product;
                const ProductModel = modelMap[group];
                if (!ProductModel) {
                    throw new global.DATA.PLUGINS.httperrors.BadRequest("Invalid product group");
                }

                console.log(ProductModel,productId,color)
                // Find the product and specific variant
                const productDoc = await ProductModel.findOne({ "productId": productId, "variants.color.name": color });
                if (!productDoc) {
                    throw new global.DATA.PLUGINS.httperrors.BadRequest("Product or variant not found");
                }

                // Check stock and update quantity
                const variant = productDoc.variants.find(v => v.color.name === color);
                const variantSize = variant.variantSizes.find(v => v.size === size);
                if (!variantSize || variantSize.quantity < quantityOrdered) {
                    throw new global.DATA.PLUGINS.httperrors.BadRequest("Insufficient stock for the variant");
                }

                variantSize.quantity -= quantityOrdered;
                await productDoc.save({ session });

                return {
                    group,
                    productId,
                    color: {
                        name: color,
                        hexcode: colorCodes[color] ? colorCodes[color] : null
                    },
                    size,
                    quantityOrdered,
                    price: product.price,
                    logoUrl: product.logoUrl,
                    logoPosition: product.logoPosition
                };
            }));

            // Create and save the order
            const newOrder = new OrderModel({
                paymentId,
                user: userId,
                address: addressId,
                products: productsProcessed,
                deliveryCharges,
                discountPercentage,
                TotalPriceAfterDiscount
            });

            const savedOrder = await newOrder.save({ session });

            // Update the user's orders list
            const user = await UserModel.findById(userId).session(session);
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('User not found');
            }
            user.orders.push(savedOrder._id);
            await user.save({ session });

            return savedOrder;
        } catch (err) {
            console.error("Error in createOrder: ", err);
            throw new Error(err.message || "An internal server error occurred");
        }
    }

    async createQuote(userId, quoteDetails) {
        const { group, productId, color, size } = quoteDetails;
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
            const product = await ProductModel.findOne({ "productId": productId, "variants.color.name": color });
            if (!product) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("Product or variant not found");
            }

            // Find the specific variant size and update the quantity
            const variant = product.variants.find(v => v.color.name === color);
            const variantSize = variant.variantSizes.find(v => v.size === size);
            if (!variantSize) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("variant size not found");
            }

            quoteDetails.color = {
                name: color,
                hexcode: colorCodes[color] ? colorCodes[color] : null
            }

            // Create and save the quote
            const newQuote = new QuoteModel({ user: userId, ...quoteDetails });
            const savedQuote = await newQuote.save();

            // Add the quote ID to the user's quotes list
            const user = await UserModel.findById(userId);
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('User not found');
            }
            user.quotes.push(savedQuote._id);
            await user.save();

            return savedQuote;
        } catch (err) {
            console.error("Error creating quote:", err.message);
            throw err;
        }
    }

}
module.exports = OrderService;