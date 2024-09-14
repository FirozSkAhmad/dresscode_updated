const express = require('express');
const Constants = require('../utils/Constants/response_messages');
const crypto = require('crypto');
const JwtHelper = require('../utils/Helpers/jwt_helper');
const PaymentModel = require('../utils/Models/paymentModel.js');
const jwtHelperObj = new JwtHelper();
const router = express.Router();
const Razorpay = require('razorpay');
const OrderModel = require('../utils/Models/orderModel.js');

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET,
});

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
            const order = await OrderModel.findOne({ orderId }).session(session);

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
                const productDoc = await ProductModel.findOne({ "productId": productId, "variants.color.name": color }).session(session);
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
            }

            // Update the order_created field to true and paymentId
            order.order_created = true;
            order.paymentId = payment[0]._id;

            // Save the changes to the database
            await order.save({ session });

            // Commit the transaction
            await session.commitTransaction();
            session.endSession();

            res.status(200).json({
                success: true,
                message: Constants.SUCCESS,
                paymentId: payment[0]._id, // Include the ID of the newly created payment
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



module.exports = router;
