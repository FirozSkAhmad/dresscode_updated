const UserModel = require('../utils/Models/userModel');
const OrderModel = require('../utils/Models/orderModel');
const QuoteModel = require('../utils/Models/quoteModel');
const HealModel = require('../utils/Models/healModel');
const EliteModel = require('../utils/Models/eliteModel');
const TogsModel = require('../utils/Models/togsModel');
const CouponModel = require('../utils/Models/couponModel');
const DresscodeCouponModel = require('../utils/Models/dressCodeCouponModel');
const mongoose = require('mongoose');
const JWTHelper = require('../utils/Helpers/jwt_helper')
const bcrypt = require('bcrypt');
const colorCodes = require('../utils/Helpers/data');
const Razorpay = require('razorpay')
const nodemailer = require('nodemailer');
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
            const { products: orderProducts, couponCode, couponType } = orderDetails;
            let totalAmount = 0;
            let totalSlabDiscountAmount = 0;
            let totalCouponDiscountAmount = 0;
            let totalPriceAfterDiscount = 0;
            let couponDiscountPercentage = 0;

            // Validate coupon if provided
            let coupon = null;
            if (couponCode) {
                if (couponType === 'trumz') {
                    // Validate Trumz coupon
                    coupon = await CouponModel.findOne({
                        couponCode,
                        status: 'pending',
                        expiryDate: { $gt: new Date() },
                        customerId: userId
                    }).session(session);

                    if (!coupon) {
                        throw new Error("Invalid, expired, or unauthorized Trumz coupon code for the customer");
                    }

                    couponDiscountPercentage = coupon.discountPercentage;
                } else if (couponType === 'dresscode') {
                    // Validate Dresscode coupon
                    const coupon = await DresscodeCouponModel.findOne({ couponCode }).session(session);

                    if (!coupon) {
                        throw new Error("Invalid Dresscode coupon code");
                    }

                    // Manually check if the coupon is expired
                    const currentDate = new Date();
                    if (coupon.expiryDate <= currentDate) {
                        throw new Error("Expired Dresscode coupon code");
                    }

                    // Check if the coupon is single-use and already used by the user
                    if (coupon.isSingleUse) {
                        const hasUsed = coupon.usedBy.some(usage => usage.userId.equals(userId));
                        if (hasUsed) {
                            throw new Error("This Dresscode coupon has already been used by the customer");
                        }
                    }

                    couponDiscountPercentage = coupon.discountPercentage;
                } else {
                    throw new Error("Invalid coupon type");
                }
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

                // Calculate slab discount percentage based on quantity
                let slabDiscountPercentage = 0;
                if (quantityOrdered >= 6 && quantityOrdered <= 10) {
                    slabDiscountPercentage = 0;//5
                } else if (quantityOrdered >= 11 && quantityOrdered <= 20) {
                    slabDiscountPercentage = 0;//10
                } else if (quantityOrdered >= 21 && quantityOrdered <= 35) {
                    slabDiscountPercentage = 0;//15
                }

                const totalPrice = productDoc.price * quantityOrdered;

                // Calculate discounts
                const slabDiscountAmount = (totalPrice * slabDiscountPercentage) / 100;
                const priceAfterSlabDiscount = totalPrice - slabDiscountAmount;

                const couponDiscountAmount = (priceAfterSlabDiscount * couponDiscountPercentage) / 100;
                const finalPriceAfterDiscount = priceAfterSlabDiscount - couponDiscountAmount;

                // Accumulate totals
                totalAmount += totalPrice;
                totalSlabDiscountAmount += slabDiscountAmount;
                totalCouponDiscountAmount += couponDiscountAmount;
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
                    name: product.name,
                    logoPosition: product.logoPosition,
                    slabDiscountPercentage,
                    slabDiscountAmount: parseFloat(slabDiscountAmount.toFixed(2)),
                    return: false, // Default to false
                    return_status: "N/A"
                };
            }));

            // Calculate and format totals
            const formattedTotalAmount = parseFloat(totalAmount.toFixed(2));
            const formattedTotalSlabDiscountAmount = parseFloat(totalSlabDiscountAmount.toFixed(2));
            const formattedTotalCouponDiscountAmount = parseFloat(totalCouponDiscountAmount.toFixed(2));
            const formattedTotalPriceAfterDiscount = parseFloat(totalPriceAfterDiscount.toFixed(2));

            // Create the order
            const newOrder = new OrderModel({
                user: userId,
                address: addressId,
                products: productsProcessed,
                deliveryCharges: 0,
                TotalAmount: formattedTotalAmount,
                totalSlabDiscountAmount: formattedTotalSlabDiscountAmount,
                couponCode: couponCode || null,
                couponType: couponType || null,
                couponDiscountPercentage: couponDiscountPercentage || 0,
                couponDiscountAmount: formattedTotalCouponDiscountAmount,
                TotalDiscountAmount: formattedTotalSlabDiscountAmount + formattedTotalCouponDiscountAmount,
                TotalPriceAfterDiscount: formattedTotalPriceAfterDiscount
            });

            const savedOrder = await newOrder.save({ session });

            // Update coupon if used
            if (coupon) {
                coupon.status = 'used';
                coupon.orderId = savedOrder._id;
                await coupon.save({ session });
            }

            // Associate the order with the user
            const user = await UserModel.findById(userId).session(session);
            if (!user) {
                throw new Error('User not found');
            }
            user.orders.push(savedOrder._id);
            await user.save({ session });

            // Generate Razorpay order
            const instance = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_SECRET,
            });

            const options = {
                amount: Math.floor(formattedTotalPriceAfterDiscount * 100), // Convert to paise
                currency: "INR",
            };

            const razorpayOrder = await instance.orders.create(options);

            return {
                razorpay_checkout_order_id: razorpayOrder.id,
                orderId: savedOrder.orderId
            };
        } catch (err) {
            console.error("Error in createOrder:", err);
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

            // Add productType to the savedQuote response
            const response = savedQuote.toObject(); // Convert Mongoose document to a plain object
            response.productType = product.productType; // Add productType to the response

            this.sendQuoteConfirmationEmail(user, savedQuote);
            this.sendQuoteNotificationEmailToAdmin(user, savedQuote);

            return response;
        } catch (err) {
            console.error("Error creating quote:", err.message);
            throw err;
        }
    }


    async sendQuoteConfirmationEmail(user, quoteDetails) {
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.SENDER_EMAIL_ID,
                    pass: process.env.SENDER_PASSWORD
                }
            });

            const emailContent = `
                <h2>Quote Request Confirmation</h2>
                <p>Dear ${user.name},</p>
                <p>Thank you for requesting a quote with DressCode E-commerce! Your quote request has been successfully created.</p>
                <p>Your quote ID is: <strong>${quoteDetails.quoteId}</strong>.</p>
                <p>To view or manage your quote, please log in to your account using the link below:</p>
                <p><a href="https://ecom.dress-code.in/login" target="_blank">Click here to log in</a></p>
                <p>If you have any questions or need further assistance, feel free to contact our support team.</p>
                <br>
                <p>Thank you for choosing DressCode E-commerce!</p>
                <p>Best regards,</p>
                <p>The DressCode Team</p>
            `;

            await transporter.sendMail({
                from: process.env.SENDER_EMAIL_ID,
                to: user.email,
                subject: "Your Quote Request Confirmation",
                html: emailContent
            });

            console.log("Quote confirmation email sent successfully.");
        } catch (error) {
            console.error("Failed to send quote confirmation email:", error.message);
        }
    }

    async sendQuoteNotificationEmailToAdmin(user, quoteDetails) {
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.SENDER_EMAIL_ID,
                    pass: process.env.SENDER_PASSWORD
                }
            });

            const emailContent = `
                <h2>New Quote Request</h2>
                <p>Dear Admin,</p>
                <p>A new quote request has been submitted by <strong>${user.name}</strong> (${user.email}).</p>
                <p>The quote ID for this request is: <strong>${quoteDetails.quoteId}</strong>.</p>
                <p>Please log in to the DressCode Admin Dashboard to review and process this quote request:</p>
                <p><a href="https://dashboard.dress-code.in/login" target="_blank">Click here to access the Admin Dashboard</a></p>
                <br>
                <p>Thank you,</p>
                <p>The DressCode Team</p>
            `;

            await transporter.sendMail({
                from: process.env.SENDER_EMAIL_ID,
                to: process.env.ADMIN_EMAIL_ID, // Admin's email address from environment variables
                subject: "New Quote Request Notification",
                html: emailContent
            });

            console.log("Quote notification email sent to admin successfully.");
        } catch (error) {
            console.error("Failed to send quote notification email to admin:", error.message);
        }
    }

}
module.exports = OrderService;