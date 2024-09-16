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
const Razorpay = require('razorpay')

class OrderService {
    constructor() {
        this.UserModel = UserModel;
        this.jwtObject = new JWTHelper();
    }

    async createOrder(userId, addressId, orderDetails, session) {
        try {
            const { products: orderProducts } = orderDetails;

            // Mapping from group to Product Model
            const modelMap = {
                "HEAL": HealModel,
                "SHIELD": ShieldModel,
                "ELITE": EliteModel,
                "TOGS": TogsModel,
                "SPIRIT": SpiritsModel,
                "WORK WEAR UNIFORMS": WorkWearModel
            };

            let totalDiscountAmount = 0; // Initialize total discount amount
            let totalPriceAfterDiscount = 0; // Initialize total price after discount
            let totalAmount = 0; // Initialize total amount without discount

            // Process each product in the order
            const productsProcessed = await Promise.all(orderProducts.map(async (product) => {
                const { group, productId, color, size, quantityOrdered } = product;
                const ProductModel = modelMap[group];
                if (!ProductModel) {
                    throw new global.DATA.PLUGINS.httperrors.BadRequest("Invalid product group");
                }

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


                // Determine the discount percentage based on the quantity ordered
                let discountPercentage = 0;
                if (quantityOrdered >= 6 && quantityOrdered <= 10) {
                    discountPercentage = 5;
                } else if (quantityOrdered >= 11 && quantityOrdered <= 20) {
                    discountPercentage = 10;
                } else if (quantityOrdered >= 21 && quantityOrdered <= 35) {
                    discountPercentage = 15;
                }

                // Calculate discount amount
                const discountAmount = (productDoc.price * quantityOrdered * discountPercentage) / 100;

                // Calculate total price after discount for this product
                const totalPrice = productDoc.price * quantityOrdered;
                const priceAfterDiscount = totalPrice - discountAmount;

                // Accumulate the total amount, total discount, and total price after discount
                totalAmount += totalPrice;
                totalDiscountAmount += discountAmount;
                totalPriceAfterDiscount += priceAfterDiscount;

                return {
                    group,
                    productId,
                    color: {
                        name: color,
                        hexcode: variant.color.hexcode
                    },
                    size,
                    quantityOrdered,
                    price: productDoc.price,
                    imgUrl: product.imgUrl,
                    logoUrl: product.logoUrl,
                    logoPosition: product.logoPosition,
                    discountPercentage,
                    discountAmount
                };
            }));

            // Create and save the order
            const newOrder = new OrderModel({
                user: userId,
                address: addressId,
                products: productsProcessed,
                deliveryCharges: 0,
                TotalAmount: totalAmount,
                TotalDiscountAmount: totalDiscountAmount,
                TotalPriceAfterDiscount: totalPriceAfterDiscount
            });

            const savedOrder = await newOrder.save({ session });

            // Update the user's orders list
            const user = await UserModel.findById(userId).session(session);
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('User not found');
            }
            user.orders.push(savedOrder._id);
            await user.save({ session });

            const instance = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_SECRET,
            });

            const options = {
                amount: Number(totalPriceAfterDiscount),
                currency: "INR",
            };
            const order = await instance.orders.create(options);

            return {
                razorpay_checkout_order_id: order.id,
                razorpay_checkout_order_amount: order.amount,
                orderId: savedOrder.orderId
            };
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