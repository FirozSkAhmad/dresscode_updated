const express = require('express');
const Constants = require('../utils/Constants/response_messages');
const crypto = require('crypto');
const JwtHelper = require('../utils/Helpers/jwt_helper');
const PaymentModel = require('../utils/Models/paymentModel.js');
const jwtHelperObj = new JwtHelper();
const router = express.Router();
const Razorpay = require('razorpay');
const OrderModel = require('../utils/Models/orderModel.js');
const mongoose = require('mongoose');
const HealModel = require('../utils/Models/healModel');
const EliteModel = require('../utils/Models/eliteModel');
const TogsModel = require('../utils/Models/togsModel');
const CouponModel = require('../utils/Models/couponModel.js');
const DresscodeCouponModel = require('../utils/Models/dressCodeCouponModel.js');
const nodemailer = require('nodemailer');
const UserService = require('../services/user_service');
const userServiceObj = new UserService();

// Mapping from group to Product Model
const modelMap = {
    "HEAL": HealModel,
    "ELITE": EliteModel,
    "TOGS": TogsModel,
};

// const instance = new Razorpay({
//     key_id: process.env.RAZORPAY_KEY_ID,
//     key_secret: process.env.RAZORPAY_SECRET,
// });

router.get("/getkey", (req, res) =>
    res.status(200).json({ key: process.env.RAZORPAY_KEY_ID })
);

// router.post('/checkout', jwtHelperObj.verifyAccessToken, async (req, res, next) => {
//     try {
//         const options = {
//             amount: Number(req.body.amount * 100),
//             currency: "INR",
//         };
//         const order = await instance.orders.create(options);

//         res.status(200).json({
//             success: true,
//             order,
//         });
//     } catch (err) {
//         next(err);
//     }
// });


router.post('/verifyPayment', jwtHelperObj.verifyAccessToken, async (req, res) => {
    // Start a session
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
        const body = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            // Assuming Payment model exists and has a create method
            const payment = await PaymentModel.create([{
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
            }], { session });

            // Find the order by orderId
            const order = await OrderModel.findOne({ orderId })
                .populate('user', 'uid name email') // Populate user fields needed for the email
                .session(session);

            if (!order) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    status: 404,
                    message: 'Order not found'
                });
            }

            // Process each product and update stock
            for (const product of order.products) {
                const { group, productId, color, size, quantityOrdered } = product;
                const ProductModel = modelMap[group];
                if (!ProductModel) {
                    throw new global.DATA.PLUGINS.httperrors.BadRequest("Invalid product group");
                }

                // Find the product and specific variant
                const productDoc = await ProductModel.findOne({ "productId": productId }).session(session);
                if (!productDoc) {
                    throw new global.DATA.PLUGINS.httperrors.BadRequest("Product or variant not found");
                }

                // Check stock and update quantity
                const variant = productDoc.variants.find(v => v.color.name === color.name);

                const variantSize = variant.variantSizes.find(v => v.size === size);
                if (!variantSize || variantSize.quantity < quantityOrdered) {
                    throw new global.DATA.PLUGINS.httperrors.BadRequest("Insufficient stock for the variant");
                }

                variantSize.quantity -= quantityOrdered;
                await productDoc.save({ session });
            }

            // Update the order_created field to true and paymentId
            order.order_created = true;
            order.paymentId = payment[0]._id;

            // Check and update the coupon status if a coupon was used
            if (order.couponCode) {
                if (order.couponType === 'trumz') {
                    // Update Trumz coupon status
                    const trumzCoupon = await CouponModel.findOne({ couponCode: order.couponCode }).session(session);

                    if (trumzCoupon) {
                        trumzCoupon.status = 'used';
                        trumzCoupon.customerId = order.user._id; // Assuming order.user is the customerId
                        trumzCoupon.orderId = order._id;
                        await trumzCoupon.save({ session });
                    }
                } else if (order.couponType === 'dresscode') {
                    // Update Dresscode coupon usage
                    const dresscodeCoupon = await DresscodeCouponModel.findOne({ couponCode: order.couponCode }).session(session);

                    if (dresscodeCoupon) {
                        // Add the user and order to the usedBy array
                        dresscodeCoupon.usedBy.push({
                            userId: order.user._id, // Assuming order.user is the userId
                            orderId: order._id
                        });
                        await dresscodeCoupon.save({ session });
                    }
                } else {
                    throw new Error("Invalid coupon type");
                }
            }

            // Save the changes to the database
            await order.save({ session });

            // Commit the transaction
            await session.commitTransaction();
            session.endSession();

            // Send confirmation email
            sendOrderConfirmationEmail(order);
            sendOrderNotificationEmailToAdmin(order);

            // After successful payment and order creation, fetch the updated orders for the user
            const userId = order.user._id;
            const ordersWithDetails = await userServiceObj.getUserOrdersWithProductDetails(userId);
            const OrderWithDetails = ordersWithDetails.find(o => o.orderId === orderId);

            // Check if the order was found
            if (!OrderWithDetails) {
                return res.status(404).json({
                    success: false,
                    message: 'No order found with the given orderId'
                });
            }

            res.status(200).json({
                success: true,
                message: Constants.SUCCESS,
                OrderWithDetails
            });
        } else {
            // Delete the order by orderId
            const deleteResult = await OrderModel.deleteOne({ orderId }).session(session);

            // Check if the order was deleted
            if (deleteResult.deletedCount === 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    status: 404,
                    message: 'Order not found or already deleted'
                });
            }

            // If the order was successfully deleted
            await session.commitTransaction();
            session.endSession();

            res.status(200).json({
                status: 200,
                message: 'Order deleted successfully'
            });

        }
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({
            success: false,
            message: err.message || Constants.ERROR,
        });
    }
});

async function sendOrderConfirmationEmail(order) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SENDER_EMAIL_ID,
                pass: process.env.SENDER_PASSWORD
            }
        });

        const emailContent = `
            <h2>Order Confirmation</h2>
            <p>Dear ${order.user.name},</p>
            <p>Thank you for placing an order with us! Your order ID is <strong>${order.orderId}</strong>.</p>
            <p>To view your order details, please log in to your account using the link below:</p>
            <p><a href="https://ecom.dress-code.in/login" target="_blank">Click here to log in</a></p>
            <p>If you have any questions or concerns, feel free to contact our support team.</p>
            <br>
            <p>Thank you for choosing DressCode E-commerce!</p>
            <p>Best regards,</p>
            <p>The DressCode Team</p>
        `;

        await transporter.sendMail({
            from: process.env.SENDER_EMAIL_ID,
            to: order.user.email,
            subject: "Your Order Confirmation",
            html: emailContent
        });

        console.log("Order confirmation email sent successfully.");
    } catch (error) {
        console.error("Failed to send order confirmation email:", error.message);
    }
}

async function sendOrderNotificationEmailToAdmin(order) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SENDER_EMAIL_ID,
                pass: process.env.SENDER_PASSWORD
            }
        });

        // Email content for the admin
        const emailContent = `
            <h2>New Order Received</h2>
            <p>Dear Admin,</p>
            <p>A new order has been placed by <strong>${order.user.name}</strong> (${order.user.email}).</p>
            <p>The order ID for this request is: <strong>${order.orderId}</strong>.</p>
            <p>Please log in to the DressCode Admin Dashboard to review and process this order:</p>
            <p><a href="https://dashboard.dress-code.in/login" target="_blank">Click here to access the Admin Dashboard</a></p>
            <br>
            <p>Thank you,</p>
            <p>The DressCode Team</p>
        `;

        // Send email to the admin
        await transporter.sendMail({
            from: process.env.SENDER_EMAIL_ID,
            to: process.env.ADMIN_EMAIL_ID, // Admin's email address from environment variables
            subject: "New Order Notification",
            html: emailContent
        });

        console.log("Order notification email sent to admin successfully.");
    } catch (error) {
        console.error("Failed to send order notification email to admin:", error.message);
    }
}

module.exports = router;
