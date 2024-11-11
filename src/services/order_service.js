const UserModel = require('../utils/Models/userModel');
const OrderModel = require('../utils/Models/orderModel');
const QuoteModel = require('../utils/Models/quoteModel');
const HealModel = require('../utils/Models/healModel');
const EliteModel = require('../utils/Models/eliteModel');
const TogsModel = require('../utils/Models/togsModel');
const CouponModel = require('../utils/Models/couponModel');
const mongoose = require('mongoose');
const JWTHelper = require('../utils/Helpers/jwt_helper')
const bcrypt = require('bcrypt');
const colorCodes = require('../utils/Helpers/data');
const Razorpay = require('razorpay')
const modelMap = {
    "HEAL": HealModel,
    "ELITE": EliteModel,
    "TOGS": TogsModel,
};

class OrderService {
    constructor() {
        this.UserModel = UserModel;
        this.jwtObject = new JWTHelper();
    }

    async createOrder(userId, addressId, orderDetails, session) {
        try {
            const { products: orderProducts, couponCode } = orderDetails;
            let totalDiscountAmount = 0;
            let totalPriceAfterDiscount = 0;
            let totalAmount = 0;
            let couponDiscountPercentage = 0;

            // Check if couponCode is provided and validate it
            if (couponCode) {
                const coupon = await CouponModel.findOne({
                    couponCode,
                    status: 'pending',
                    expiryDate: { $gt: new Date() },
                    customerId: userId
                });

                if (!coupon) {
                    throw new Error("Invalid, expired, or unauthorized coupon code for the customer");
                }

                // Use the discount percentage from the coupon
                couponDiscountPercentage = coupon.discountPercentage;
            }

            // Process each product in the order
            const productsProcessed = await Promise.all(orderProducts.map(async (product) => {
                const { group, productId, color, size, quantityOrdered } = product;
                const ProductModel = modelMap[group.trim().toUpperCase()];
                if (!ProductModel) {
                    throw new Error("Invalid product group");
                }

                const productDoc = await ProductModel.findOne({ productId, "variants.color.name": color });
                if (!productDoc) {
                    throw new Error("Product or variant not found");
                }

                const variant = productDoc.variants.find(v => v.color.name === color);
                const variantSize = variant.variantSizes.find(v => v.size === size);
                if (!variantSize || variantSize.quantity < quantityOrdered) {
                    throw new Error("Insufficient stock for the variant");
                }

                let discountPercentage = 0;
                if (quantityOrdered >= 6 && quantityOrdered <= 10) {
                    discountPercentage = 5;
                } else if (quantityOrdered >= 11 && quantityOrdered <= 20) {
                    discountPercentage = 10;
                } else if (quantityOrdered >= 21 && quantityOrdered <= 35) {
                    discountPercentage = 15;
                }

                // Calculate price and discounts
                const totalPrice = productDoc.price * quantityOrdered;
                const initialDiscountAmount = (totalPrice * discountPercentage) / 100;
                const priceAfterInitialDiscount = totalPrice - initialDiscountAmount;

                // Apply additional discount from the coupon on the already discounted price
                const couponDiscountAmount = (priceAfterInitialDiscount * couponDiscountPercentage) / 100;
                const finalPriceAfterDiscount = priceAfterInitialDiscount - couponDiscountAmount;

                // Accumulate totals
                totalAmount += totalPrice;
                totalDiscountAmount += initialDiscountAmount + couponDiscountAmount;
                totalPriceAfterDiscount += finalPriceAfterDiscount;

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
                    initialDiscountAmount: parseFloat(initialDiscountAmount.toFixed(2)),
                    couponDiscountPercentage,
                    couponDiscountAmount: parseFloat(couponDiscountAmount.toFixed(2)),
                    priceAfterDiscount: parseFloat(finalPriceAfterDiscount.toFixed(2))
                };
            }));

            // Format totals to 2 decimal places before saving
            const formattedTotalAmount = parseFloat(totalAmount.toFixed(2));
            const formattedTotalDiscountAmount = parseFloat(totalDiscountAmount.toFixed(2));
            const formattedTotalPriceAfterDiscount = parseFloat(totalPriceAfterDiscount.toFixed(2));

            // Create and save the order
            const newOrder = new OrderModel({
                user: userId,
                address: addressId,
                products: productsProcessed,
                deliveryCharges: 0,
                TotalAmount: formattedTotalAmount,
                TotalDiscountAmount: formattedTotalDiscountAmount,
                TotalPriceAfterDiscount: formattedTotalPriceAfterDiscount,
                couponCode: couponCode || null,
                couponDiscountPercentage: couponDiscountPercentage || 0
            });

            const savedOrder = await newOrder.save({ session });

            const user = await UserModel.findById(userId).session(session);
            if (!user) {
                throw new Error('User not found');
            }
            user.orders.push(savedOrder._id);
            await user.save({ session });

            const instance = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_SECRET,
            });

            console.log("formattedTotalPriceAfterDiscount", formattedTotalPriceAfterDiscount)
            console.log("amount", formattedTotalPriceAfterDiscount * 100)

            const options = {
                amount: formattedTotalPriceAfterDiscount * 100, // Convert to paise (integer for Razorpay)
                currency: "INR",
            };

            const razorpayOrder = await instance.orders.create(options);

            return {
                razorpay_checkout_order_id: razorpayOrder.id,
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