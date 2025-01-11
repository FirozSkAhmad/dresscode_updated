const UserModel = require('../utils/Models/userModel');
const OrderModel = require('../utils/Models/orderModel');
const HealModel = require('../utils/Models/healModel');
const EliteModel = require('../utils/Models/eliteModel');
const TogsModel = require('../utils/Models/togsModel');
const DresscodeCouponModel = require('../utils/Models/dressCodeCouponModel');
const mongoose = require('mongoose');
const JWTHelper = require('../utils/Helpers/jwt_helper')
const bcrypt = require('bcrypt');
const colorCodes = require('../utils/Helpers/data');
const nodemailer = require('nodemailer');
const modelMap = {
    "HEAL": HealModel,
    "ELITE": EliteModel,
    "TOGS": TogsModel,
};

class UserService {
    constructor() {
        this.UserModel = UserModel;
        this.jwtObject = new JWTHelper();
    }

    async createUser(userDetails, session) {
        try {
            const { name, email, gender, phoneNumber, password } = userDetails;
            let errors = [];

            // In createUser function
            const [existingUserEmail, existingUserPhone] = await Promise.all([
                UserModel.findOne({ email: email.toLowerCase() }).session(session),
                UserModel.findOne({ phoneNumber: phoneNumber }).session(session)
            ]);

            if (existingUserEmail) {
                errors.push("Email address already in use");
            }
            if (existingUserPhone) {
                errors.push("Phone number already in use");
            }

            if (errors.length > 0) {
                throw new Error(errors.join(", "));
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
            const newUser = await UserModel.create([userPayload], { session: session });

            return newUser;
        } catch (err) {
            console.error("Error in createUser: ", err.message);
            throw new Error(err.message || "An internal server error occurred");
        }
    }


    async loginUser(userDetails, session, res) {
        try {
            const userData = await UserModel.findOne({ email: userDetails.email }).session(session);

            if (!userData) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("No user exists with given email");
            }

            const isValid = await bcrypt.compare(userDetails.password, userData.password);
            if (!isValid) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("Incorrect Password");
            }

            // If you need to update last login time or log the login attempt
            await UserModel.updateOne(
                { _id: userData._id },
                { $set: { lastLogin: new Date() } },
                { session: session }
            );

            const tokenPayload = userData._id + ":" + userData.name;
            const accessToken = await this.jwtObject.generateAccessToken(tokenPayload);
            const refreshToken = await this.jwtObject.generateRefreshToken(tokenPayload);

            // Set the refresh token in an HTTP-only cookie
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,  // Prevents JavaScript from accessing the cookie
                secure: true,    // Requires HTTPS to be enabled
                sameSite: 'None', // Allows the cookie to be sent on cross-site requests
                maxAge: 604800000, // 7 days in milliseconds
                path: '/'
            });

            const data = {
                accessToken: accessToken,
                refreshToken: refreshToken,
                userId: userData._id,
                name: userData.name,
                email: userData.email,
                phoneNumber: userData.phoneNumber,
                uid: null,
                gLogin: false
            };

            return data;
        } catch (err) {
            console.error("Error in loginUser with transaction: ", err.message);
            throw err;
        }
    }

    // Service function for forgot password
    async forgotPassword(userDetails, session) {
        try {
            // Check if the user exists by email
            const userData = await UserModel.findOne({ email: userDetails.email }).session(session);

            if (!userData) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("No user exists with the given email");
            }

            // Generate a JWT token with user ID for password reset, expires in 1 hour
            const tokenPayload = userData._id + ":" + userData.name;
            const resetToken = await this.jwtObject.generateAccessToken(tokenPayload);

            // Generate password reset URL
            const resetUrl = `${process.env.RESET_PASSWORD_ECOM_ROUTE}?token=${resetToken}`;

            // Send reset email using Nodemailer
            await this.sendResetEmail(userDetails.email, resetUrl);

            return { message: "Password reset email sent successfully to admin." };
        } catch (err) {
            console.error("Error in forgotPassword with transaction: ", err.message);
            throw err;
        }
    }

    // Function to send reset password email
    async sendResetEmail(toEmail, resetUrl) {
        const nodemailer = require('nodemailer');

        // Create transporter object using SMTP transport
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SENDER_EMAIL_ID,  // your admin email
                pass: process.env.SENDER_PASSWORD // your admin password
            }
        });

        // Email content
        const mailOptions = {
            from: process.env.SENDER_EMAIL_ID,
            to: toEmail,
            subject: 'Password Reset Request',
            html: `<p>You requested a password reset. Click the link below to reset your password:</p>
               <a href="${resetUrl}">${resetUrl}</a>
               <p>If you did not request this, please ignore this email.</p>`
        };

        // Send email
        await transporter.sendMail(mailOptions);
    }


    async resetPassword(token, newPassword, session) {
        try {
            // Verify the JWT token to get user ID
            const decodedToken = await new Promise((resolve, reject) => {
                global.DATA.PLUGINS.jsonwebtoken.verify(token, process.env.ACCESS_TOKEN_SECRETKEY, (err, decoded) => {
                    if (err) reject(new global.DATA.PLUGINS.httperrors.Unauthorized("Token Invalid/Expired"));
                    resolve(decoded);
                });
            });
            const userId = decodedToken.aud.split(":")[0];

            // Validate new password
            if (!newPassword || typeof newPassword !== 'string') {
                throw new Error("New password is required and must be a valid string.");
            }

            // Hash the password
            const salt = await bcrypt.genSalt(10);
            if (!salt) {
                throw new Error("Failed to generate salt.");
            }
            console.log('Salt:', salt);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // Update the user's password
            await UserModel.updateOne(
                { _id: userId },
                { $set: { password: hashedPassword } },
                { session: session }
            );

            return { message: "Password successfully updated" };
        } catch (err) {
            console.error("Error in resetPassword with transaction: ", err.message);
            throw err;
        }
    }

    async getUserCoupons(userId) {
        try {
            // Find the user by userId and populate the associated Trumz coupons
            const user = await UserModel.findById(userId).populate({
                path: 'coupons', // Assumes `coupons` is an array of coupon references in the User schema
                select: 'couponCode discountPercentage expiryDate linkedGroup linkedProductId usedDate', // Exclude `status`
                options: { sort: { expiryDate: 1 } }
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Fetch all Dresscode coupons
            const dresscodeCoupons = await DresscodeCouponModel.find({});

            const currentDate = new Date();

            // Process Trumz coupons
            const trumzCouponsData = user.coupons.map(coupon => {
                let dynamicStatus;
                if (coupon.usedDate) {
                    dynamicStatus = 'used';
                } else if (currentDate > coupon.expiryDate) {
                    dynamicStatus = 'expired';
                } else {
                    dynamicStatus = 'pending';
                }

                return {
                    couponCode: coupon.couponCode,
                    discountPercentage: coupon.discountPercentage,
                    expiryDate: coupon.expiryDate,
                    linkedGroup: coupon.linkedGroup,
                    linkedProductId: coupon.linkedProductId,
                    usedDate: coupon.usedDate,
                    status: dynamicStatus,
                    couponType: 'trumz' // Add type to differentiate
                };
            });

            const dresscodeCouponsData = dresscodeCoupons.flatMap(coupon => {
                let hasUsed = coupon.usedBy.some(usage => usage.userId.equals(userId)); // Check if the user has used the coupon

                if (coupon.isSingleUse) {
                    // For single-use coupons
                    let dynamicStatus;

                    if (hasUsed) {
                        dynamicStatus = 'used'; // Coupon has been used by the user
                    } else if (currentDate > coupon.expiryDate) {
                        dynamicStatus = 'expired'; // Coupon has expired
                    } else {
                        dynamicStatus = 'pending'; // Coupon is still valid and unused
                    }

                    return [{
                        couponCode: coupon.couponCode,
                        discountPercentage: coupon.discountPercentage,
                        expiryDate: coupon.expiryDate,
                        linkedGroup: null, // Dresscode coupons don't have linkedGroup, so set to null
                        linkedProductId: null, // Dresscode coupons don't have linkedProductId, so set to null
                        usedDate: hasUsed ? coupon.usedBy.find(usage => usage.userId.equals(userId)).usedDate : null, // Set usedDate if the user has used the coupon
                        status: dynamicStatus,
                        couponType: 'dresscode' // Add type to differentiate
                    }];
                } else {
                    // For multi-use coupons
                    const results = [];

                    if (hasUsed) {
                        // Add an entry for the used coupon
                        results.push({
                            couponCode: coupon.couponCode,
                            discountPercentage: coupon.discountPercentage,
                            expiryDate: coupon.expiryDate,
                            linkedGroup: null,
                            linkedProductId: null,
                            usedDate: coupon.usedBy.find(usage => usage.userId.equals(userId)).usedDate, // Set usedDate
                            status: 'used', // Status is "used"
                            couponType: 'dresscode'
                        });
                    }

                    // Add an entry for the pending/expired coupon
                    if (currentDate > coupon.expiryDate) {
                        results.push({
                            couponCode: coupon.couponCode,
                            discountPercentage: coupon.discountPercentage,
                            expiryDate: coupon.expiryDate,
                            linkedGroup: null,
                            linkedProductId: null,
                            usedDate: null, // No usedDate for pending/expired
                            status: 'expired', // Status is "expired"
                            couponType: 'dresscode'
                        });
                    } else {
                        results.push({
                            couponCode: coupon.couponCode,
                            discountPercentage: coupon.discountPercentage,
                            expiryDate: coupon.expiryDate,
                            linkedGroup: null,
                            linkedProductId: null,
                            usedDate: null, // No usedDate for pending/expired
                            status: 'pending', // Status is "pending"
                            couponType: 'dresscode'
                        });
                    }

                    return results;
                }
            });

            // Combine both Trumz and Dresscode coupons into a single array
            const allCoupons = [...trumzCouponsData, ...dresscodeCouponsData];

            // Return the combined array
            return allCoupons;
        } catch (error) {
            console.error('Error fetching coupons for user:', error.message);
            throw error;
        }
    }

    async getUserActiveCoupons(userId, group, productId) {
        try {
            // Find the user by userId and populate only "pending" (active) coupons
            const user = await UserModel.findById(userId).populate({
                path: 'coupons',
                match: {
                    status: 'pending',
                    expiryDate: { $gt: new Date() }, // Add expiry date filter
                    $or: [
                        { linkedGroup: { $eq: group } }, // Matches specific group if provided
                        { linkedGroup: null } // Also includes coupons with no linkedGroup
                    ],
                    $or: [
                        { linkedProductId: { $eq: productId } }, // Matches specific productId if provided
                        { linkedProductId: null } // Also includes coupons with no linkedProductId
                    ]
                },
                select: 'couponCode discountPercentage status expiryDate linkedGroup linkedProductId usedDate' // Optional: Select specific fields
            });

            if (!user) {
                throw new Error('User not found');
            }

            // If the user has no associated active coupons
            if (!user.coupons || user.coupons.length === 0) {
                throw new Error('No active coupons found for this user');
            }

            return user.coupons;

        } catch (error) {
            console.error('Error fetching active coupons for user:', error.message);
            throw error;
        }
    }

    async getCartActiveCoupons(userId, filters) {
        try {
            // Build match conditions dynamically with an added expiry date check
            const matchConditions = {
                status: 'pending',
                expiryDate: { $gt: new Date() }, // Ensure the coupon has not expired
                $or: filters.map(filter => ({
                    $and: [
                        {
                            $or: [
                                { linkedGroup: { $eq: filter.group } },
                                { linkedGroup: null }
                            ]
                        },
                        {
                            $or: [
                                { linkedProductId: { $eq: filter.productId } },
                                { linkedProductId: null }
                            ]
                        }
                    ]
                }))
            };

            // Find the user by userId and populate only "pending" (active) coupons
            const user = await UserModel.findById(userId).populate({
                path: 'coupons',
                match: matchConditions,
                select: 'couponCode discountPercentage status expiryDate linkedGroup linkedProductId' // Optional: Select specific fields
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Process Trumz coupons
            const trumzCouponsData = user.coupons.map(coupon => ({
                couponCode: coupon.couponCode,
                discountPercentage: coupon.discountPercentage,
                expiryDate: coupon.expiryDate,
                linkedGroup: coupon.linkedGroup,
                linkedProductId: coupon.linkedProductId,
                status: coupon.status,
                couponType: 'trumz', // Add type to differentiate
                applicableTo: {
                    group: coupon.linkedGroup,
                    productId: coupon.linkedProductId
                }
            }));

            // Fetch Dresscode coupons
            const dresscodeCoupons = await DresscodeCouponModel.find({});
            const currentDate = new Date(); // Define currentDate as the current date and time

            const dresscodeCouponsData = dresscodeCoupons
                .filter(coupon => {
                    if (coupon.isSingleUse) {
                        // For single-use coupons, check if the user has used it
                        const hasUsed = coupon.usedBy.some(usage => usage.userId.equals(userId));
                        return !hasUsed; // Include only if the user has NOT used it
                    } else {
                        // For multi-use coupons, always include them
                        return true;
                    }
                })
                .map(coupon => {
                    // Determine the status based on expiry date
                    const status = (currentDate > coupon.expiryDate) ? 'expired' : 'pending';

                    return {
                        couponCode: coupon.couponCode,
                        discountPercentage: coupon.discountPercentage,
                        expiryDate: coupon.expiryDate,
                        linkedGroup: null, // Dresscode coupons don't have linkedGroup
                        linkedProductId: null, // Dresscode coupons don't have linkedProductId
                        status: status, // Set status based on expiry date
                        couponType: 'dresscode', // Add type to differentiate
                        applicableTo: {
                            group: null,
                            productId: null
                        }
                        // isSingleUse is excluded from the response
                    };
                })
                .filter(coupon => coupon.status === 'pending'); // Only include coupons with status 'pending'

            // Combine Trumz and Dresscode coupons into a single array
            const allCoupons = [...trumzCouponsData, ...dresscodeCouponsData];

            // Return the combined array
            return allCoupons;
        } catch (error) {
            console.error('Error fetching active coupons for user:', error.message);
            throw error;
        }
    }

    async getUserDetails(userId) {
        try {
            const user = await UserModel.findById(userId, 'name email gender phoneNumber');
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('User not found');
            }
            return user;
        } catch (err) {
            console.error("Error retrieving user details:", err.message);
            throw err;
        }
    }

    async updateUserDetails(userId, updates, session) {
        try {
            const user = await UserModel.findById(userId).session(session);
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("User not found");
            }

            // Update user details
            user.firstName = updates.firstName || user.firstName;
            user.lastName = updates.lastName || user.lastName;
            user.email = updates.email || user.email;
            user.phoneNumber = updates.phoneNumber || user.phoneNumber;
            user.gender = updates.gender || user.gender;

            // Use the session to save the updated user info
            await user.save({ session: session });

            return {
                status: 200,
                message: "User details updated successfully",
                userDetails: {
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    gender: user.gender
                }
            };
        } catch (err) {
            console.error("Error updating user details:", err.message);
            throw err; // Propagate error to be handled by middleware
        }
    }


    async addAddress(userId, newAddress, session) {
        try {
            const user = await this.UserModel.findById(userId).session(session);
            if (!user) {
                throw new Error("User not found");
            }

            if (newAddress.markAsDefault) {
                // Reset the default setting on all other addresses
                user.addresses.forEach(addr => addr.markAsDefault = false);
            }

            // Add the new address which may or may not be marked as default
            user.addresses.push(newAddress);

            // Save the user with the updated address list within the transaction
            const updatedUser = await user.save({ session: session });

            // Return only the newly added address (it will be the last one in the array)
            const addedAddress = updatedUser.addresses[updatedUser.addresses.length - 1];
            return addedAddress;
        } catch (err) {
            console.error("Error adding address:", err.message);
            throw err; // Rethrow the error to be handled by the caller
        }
    }

    async updateAddress(userId, addressId, addressUpdates, session) {
        try {
            const user = await this.UserModel.findById(userId).session(session);
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("User not found");
            }

            // Check if markAsDefault is provided and true
            if (addressUpdates.markAsDefault === true) {
                // Reset all other addresses' markAsDefault to false
                user.addresses.forEach(addr => {
                    if (addr._id.toString() !== addressId) {
                        addr.markAsDefault = false;
                    } else {
                        // Set the target address as default
                        addr.markAsDefault = true;
                    }
                });
            } else {
                // Find the specific address and ensure at least one default remains
                const addressToUpdate = user.addresses.id(addressId);
                if (!addressToUpdate) {
                    throw new global.DATA.PLUGINS.httperrors.BadRequest("Address not found");
                }

                // If trying to unset the default and it's the last one, throw error
                if (addressToUpdate.markAsDefault && !user.addresses.some(addr => addr.markAsDefault && addr._id.toString() !== addressId)) {
                    throw new global.DATA.PLUGINS.httperrors.BadRequest("At least one address must be marked as default");
                }

                // Update the fields provided in addressUpdates
                Object.assign(addressToUpdate, addressUpdates);
            }

            // Save the user object with the modifications within the transaction
            const updatedUser = await user.save({ session: session });

            // Return only the updated address
            return updatedUser.addresses.id(addressId);
        } catch (err) {
            console.error("Error updating address:", err.message);
            throw err;  // Propagate error to be handled by the caller
        }
    }


    async setDefaultAddress(userId, addressId, session) {
        try {
            // First, unset all addresses' markAsDefault
            await this.UserModel.updateOne(
                { _id: userId },
                { $set: { "addresses.$[].markAsDefault": false } },
                { session }
            );

            // Then, set the specified address's markAsDefault to true
            const result = await this.UserModel.updateOne(
                { _id: userId, "addresses._id": addressId },
                { $set: { "addresses.$.markAsDefault": true } },
                { session }
            );

            if (result.nModified === 0) {
                throw global.DATA.PLUGINS.httperrors.BadRequest("Address not found or already set as default.");
            }

            return { message: "Default address updated successfully." };
        } catch (err) {
            console.error("Error setting default address:", err.message);
            throw err;
        }
    }

    async deleteAddress(userId, addressId, session) {
        try {
            // Use the session in findOneAndUpdate to ensure the operation is part of the transaction
            const user = await this.UserModel.findOneAndUpdate(
                { "_id": userId, "addresses._id": addressId },
                { "$set": { "addresses.$.isDeleted": true } },
                { new: true, session: session }
            );

            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("User not found or address does not exist");
            }

            return { message: "Address marked as deleted successfully." };
        } catch (err) {
            console.error("Error deleting address:", err.message);
            throw err;
        }
    }

    async getActiveAddresses(userId) {
        try {
            const user = await this.UserModel.findById(userId, 'addresses').exec();
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("User not found");
            }

            // Filter addresses where isDeleted is false
            const activeAddresses = user.addresses.filter(addr => !addr.isDeleted).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            return activeAddresses;
        } catch (err) {
            console.error("Error retrieving active addresses:", err.message);
            throw err;
        }
    }

    async createOrder(orderDetails) {
        try {
            const newOrder = new OrderModel(orderDetails);
            const savedOrder = await newOrder.save();
            return savedOrder;
        } catch (err) {
            console.error("Error creating order:", err.message);
            throw err;
        }
    }

    async enhanceOrderWithProductDetails(order) {
        const productsWithDetails = await Promise.all(order.products.map(async (product) => {
            const ProductModel = modelMap[product.group];
            if (!ProductModel) {
                throw new Error("Invalid product group");
            }

            const productDetails = await ProductModel.findOne({ productId: product.productId })
                .select('-variants -reviews -isDeleted -createdAt -updatedAt -__v');

            const priceAfterSlabDiscount = parseFloat(
                (product.price * product.quantityOrdered - product.slabDiscountAmount).toFixed(2)
            );

            return {
                ...product.toObject(),
                productDetails: productDetails ? productDetails.toObject() : {},
                priceAfterSlabDiscount // Include the calculated field
            };
        }));

        return productsWithDetails;
    }


    async getUserOrdersWithProductDetails(userId) {
        try {
            // Find the user and populate only orders where deliveryStatus is not "Canceled"
            const user = await UserModel.findById(userId)
                .populate({
                    path: 'orders',
                    match: { deliveryStatus: { $ne: 'Canceled' }, order_created: { $ne: false } },  // Filter out "Canceled" orders
                    options: { sort: { dateOfOrder: -1 } }
                });

            if (!user) {
                throw new Error('User not found');
            }

            const ordersWithDetails = await Promise.all(user.orders.map(async (order) => {
                const productsWithDetails = await this.enhanceOrderWithProductDetails(order);
                const addressDetails = user.addresses.id(order.address);

                if (!addressDetails) {
                    throw new Error("Address not found");
                }

                return {
                    userDetails: {
                        name: user.name,
                        email: user.email,
                        gender: user.gender ? user.gender : "N/A",
                        phoneNumber: user.phoneNumber ? user.phoneNumber : "N/A"
                    },
                    ...order.toObject(),
                    products: productsWithDetails,
                    addressDetails: addressDetails.toObject()
                };
            }));

            return ordersWithDetails;
        } catch (err) {
            console.error("Error retrieving orders with product and address details:", err);
            throw err;
        }
    }

    async cancelOrder(orderId) {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();

            // Find the order by orderId within the session
            const order = await OrderModel.findOne({ orderId: orderId })
                .populate('user', 'firstName email') // Populate user fields needed for the email
                .session(session);

            if (!order) {
                await session.abortTransaction();
                session.endSession();
                return { success: false, statusCode: 404, message: "Order not found" };
            }

            // Check if shiprocket_order_id is null
            if (order.shiprocket_order_id !== null) {
                await session.abortTransaction();
                session.endSession();
                return {
                    success: false,
                    statusCode: 400,
                    message: "Order cannot be canceled, as it's already processed for delivery."
                };
            }

            // Update the order's deliveryStatus, refund_payment_status, and dateOfCanceled
            order.deliveryStatus = 'Canceled';
            order.refund_payment_status = 'Pending';
            order.dateOfCanceled = new Date();

            // Save the updated order within the session
            await order.save({ session });

            // Loop through each product in the order
            await Promise.all(order.products.map(async (product) => {
                const ProductModel = modelMap[product.group];
                if (!ProductModel) {
                    console.error(`No model found for group ${product.group}`);
                    return;
                }

                // Find the product document within the session
                const productDoc = await ProductModel.findOne({ productId: product.productId }).session(session);
                if (!productDoc) {
                    console.error(`Product with productId ${product.productId} not found`);
                    return;
                }

                // Find the variant by color
                const variant = productDoc.variants.find(v => v.color.name === product.color.name);
                if (!variant) {
                    console.error(`Variant with color ${product.color.name} not found for product ${product.productId}`);
                    return;
                }

                // Find the variant size
                const variantSize = variant.variantSizes.find(vs => vs.size === product.size);
                if (!variantSize) {
                    console.error(`Size ${product.size} not found for product ${product.productId}`);
                    return;
                }

                // Add the quantity back
                variantSize.quantity += product.quantityOrdered;

                // Save the updated product document within the session
                await productDoc.save({ session });
            }));

            // Commit the transaction and end the session
            await session.commitTransaction();
            session.endSession();

            // Send cancellation email
            this.sendCancellationEmail(order);
            this.sendCancellationEmailToAdmin(order);

            return { success: true, order: order.toObject() };

        } catch (error) {
            // If any error occurred, abort the transaction
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            session.endSession();

            console.error("Error in canceling the order:", error.message);
            // Re-throw the error to be handled by the controller
            throw error;
        }
    }

    // Function to send cancellation email
    async sendCancellationEmail(order) {
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.SENDER_EMAIL_ID,
                    pass: process.env.SENDER_PASSWORD
                }
            });

            const emailContent = `
            <h2>Order Cancellation Confirmation</h2>
            <p>Dear ${order.user.name},</p>
            <p>Your order with ID <strong>${order.orderId}</strong> has been successfully canceled.</p>
            <p>You can log in to your DressCode account to review your order details or manage your account:</p>
            <p><a href="https://ecom.dress-code.in/login" target="_blank">Click here to log in</a></p>
            <p>If you have any questions, feel free to contact our support team.</p>
            <br>
            <p>Thank you,</p>
            <p>The DressCode Team</p>
        `;

            await transporter.sendMail({
                from: process.env.SENDER_EMAIL_ID,
                to: order.user.email,
                subject: "Order Cancellation Confirmation",
                html: emailContent
            });

            console.log("Cancellation email sent successfully.");
        } catch (error) {
            console.error("Failed to send cancellation email:", error.message);
        }
    }

    // Function to send cancellation email to admin
    async sendCancellationEmailToAdmin(order) {
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.SENDER_EMAIL_ID,
                    pass: process.env.SENDER_PASSWORD
                }
            });

            const adminEmailContent = `
            <h2>Order Cancellation Notification</h2>
            <p>Dear Admin,</p>
            <p>An order with ID <strong>${order.orderId}</strong> has been canceled by the user <strong>${order.user.name}</strong> (${order.user.email}).</p>
            <p>Please log in to the DressCode Admin Dashboard to review the details of the canceled order:</p>
            <p><a href="https://dashboard.dress-code.in/login" target="_blank">Click here to access the Warehouse Dashboard</a></p>
            <br>
            <p>Thank you,</p>
            <p>The DressCode Team</p>
        `;

            await transporter.sendMail({
                from: process.env.SENDER_EMAIL_ID,
                to: process.env.ADMIN_EMAIL_ID, // Assuming you have an environment variable for the admin's email
                subject: "Order Cancellation Notification",
                html: adminEmailContent
            });

            console.log("Cancellation email sent to admin successfully.");
        } catch (error) {
            console.error("Failed to send cancellation email to admin:", error.message);
        }
    }

    async getUserCanceledOrdersWithProductDetails(userId) {
        try {
            // Find the user and populate only orders where deliveryStatus is "Canceled"
            const user = await UserModel.findById(userId)
                .populate({
                    path: 'orders',
                    match: { deliveryStatus: 'Canceled', order_created: { $ne: false } }  // Filter to only "Canceled" orders
                });

            if (!user) {
                throw new Error('User not found');
            }

            const ordersWithDetails = await Promise.all(user.orders.map(async (order) => {
                const productsWithDetails = await this.enhanceOrderWithProductDetails(order);
                const addressDetails = user.addresses.id(order.address);

                if (!addressDetails) {
                    throw new Error("Address not found");
                }

                return {
                    ...order.toObject(),
                    products: productsWithDetails,
                    addressDetails: addressDetails.toObject()
                };
            }));

            return ordersWithDetails;
        } catch (err) {
            console.error("Error retrieving canceled orders with product and address details:", err);
            throw err;
        }
    }

    async getUserReturnOrdersWithProductDetails(userId) {
        try {
            // Find the user and populate return orders along with paymentId and other necessary details
            const user = await UserModel.findById(userId)
                .populate({
                    path: 'returnOrders',
                    populate: {
                        path: 'paymentId', // Populate the paymentId within the returnOrders
                    },
                });

            if (!user) {
                throw new Error('User not found');
            }

            const returnOrdersWithDetails = await Promise.all(user.returnOrders.map(async (returnOrder) => {
                const productsWithDetails = await this.enhanceOrderWithProductDetails(returnOrder);
                const addressDetails = user.addresses.id(returnOrder.address); // Fixed returnOrder.address reference

                if (!addressDetails) {
                    throw new Error("Address not found");
                }

                return {
                    ...returnOrder.toObject(),
                    products: productsWithDetails,
                    addressDetails: addressDetails.toObject(),
                    paymentDetails: returnOrder.paymentId ? returnOrder.paymentId.toObject() : null, // Include payment details if available
                };
            }));

            return returnOrdersWithDetails;
        } catch (err) {
            console.error("Error retrieving return orders with product and address details:", err);
            throw err;
        }
    }

    async getUserQuotesWithProductDetails(userId) {
        try {
            // Find the user's orders
            const user = await UserModel.findById(userId).populate('quotes');
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('User not found');
            }

            // For each order, find the product details from the respective model
            const quotesWithDetails = await Promise.all(user.quotes.map(async (quote) => {
                const ProductModel = modelMap[quote.group];
                if (!ProductModel) {
                    throw new global.DATA.PLUGINS.httperrors.BadRequest("Invalid product group");
                }
                const productDetails = await ProductModel.findOne({ productId: quote.productId }).select('-variants -reviews -isDeleted -createdAt -updatedAt -__v');
                return {
                    ...quote.toObject(),
                    productDetails
                };
            }));

            return quotesWithDetails;
        } catch (err) {
            console.error("Error retrieving orders with product details:", err);
            throw err;
        }
    }

    // async addToCart(userId, cartItem, session) {
    //     try {
    //         cartItem.color = {
    //             name: cartItem.color,
    //             hexcode: colorCodes[cartItem.color] ? colorCodes[cartItem.color] : null
    //         }

    //         const user = await UserModel.findById(userId).session(session);
    //         if (!user) {
    //             throw new global.DATA.PLUGINS.httperrors.BadRequest('User not found');
    //         }

    //         // Check if the cart item already exists
    //         const existingItem = user.cart.find(item =>
    //             item.productId === cartItem.productId &&
    //             item.group === cartItem.group &&
    //             item.color.name === cartItem.color.name &&
    //             item.size === cartItem.size
    //         );

    //         if (existingItem) {
    //             // Item exists, update the quantity
    //             existingItem.quantityRequired += cartItem.quantityRequired;
    //         } else {
    //             // New item, add to cart
    //             user.cart.push(cartItem);
    //         }

    //         await user.save({ session });

    //         // Return only the item affected
    //         const addedOrUpdatedCartItem = existingItem || user.cart[user.cart.length - 1];
    //         return addedOrUpdatedCartItem;
    //     } catch (err) {
    //         console.error("Error adding to cart:", err.message);
    //         throw err;
    //     }
    // }

    async addProductToCart(userId, cartItem, session) {
        try {
            cartItem.color = {
                name: cartItem.color,
                hexcode: colorCodes[cartItem.color] ? colorCodes[cartItem.color] : null
            }

            const user = await UserModel.findById(userId).session(session);
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('User not found');
            }

            // Check if the cart item already exists
            const existingItem = user.cart.find(item =>
                item.productId === cartItem.productId &&
                item.group === cartItem.group &&
                item.color.name === cartItem.color.name &&
                item.size === cartItem.size
            );

            if (existingItem) {
                // Item exists, update the quantity
                existingItem.quantityRequired += cartItem.quantityRequired;
            } else {
                // New item, add to cart
                user.cart.push(cartItem);
            }

            await user.save({ session });

            // Return only the item affected
            const addedOrUpdatedCartItem = existingItem || user.cart[user.cart.length - 1];

            const ProductModel = modelMap[cartItem.group];
            if (!ProductModel) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("Invalid product group");
            }
            const productDoc = await ProductModel.findOne({ "productId": cartItem.productId, "variants.color.name": cartItem.color.name });
            if (!productDoc) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("Product or variant not found");
            }

            const variant = productDoc.variants.find(v => v.color.name === cartItem.color.name);
            const variantSize = variant.variantSizes.find(v => v.size === cartItem.size);

            // Convert to plain JavaScript object
            const productDetails = productDoc.toObject();

            // Removing the specified fields
            delete productDetails.variants;
            delete productDetails.reviews;
            delete productDetails.isDeleted;
            delete productDetails.createdAt;
            delete productDetails.updatedAt;
            delete productDetails.__v;

            if (!variantSize || variantSize.quantity < cartItem.quantityRequired) {
                return {
                    color: addedOrUpdatedCartItem.color,
                    group: addedOrUpdatedCartItem.group,
                    productId: addedOrUpdatedCartItem.productId,
                    size: addedOrUpdatedCartItem.size,
                    quantityRequired: addedOrUpdatedCartItem.quantityRequired,
                    imgUrl: addedOrUpdatedCartItem.imgUrl,
                    logoUrl: addedOrUpdatedCartItem.logoUrl,
                    name: addedOrUpdatedCartItem.name,
                    logoPosition: addedOrUpdatedCartItem.logoPosition,
                    checked: true,
                    _id: addedOrUpdatedCartItem._id,
                    isRequiredQuantityPresent: false,
                    message: `Insufficient stock for this item, only ${variantSize.quantity} left!`,
                    productDetails
                };
            } else {
                return {
                    color: addedOrUpdatedCartItem.color,
                    group: addedOrUpdatedCartItem.group,
                    productId: addedOrUpdatedCartItem.productId,
                    size: addedOrUpdatedCartItem.size,
                    quantityRequired: addedOrUpdatedCartItem.quantityRequired,
                    imgUrl: addedOrUpdatedCartItem.imgUrl,
                    logoUrl: addedOrUpdatedCartItem.logoUrl,
                    name: addedOrUpdatedCartItem.name,
                    logoPosition: addedOrUpdatedCartItem.logoPosition,
                    checked: true,
                    _id: addedOrUpdatedCartItem._id,
                    isRequiredQuantityPresent: true,
                    productDetails
                };
            }
        } catch (err) {
            console.error("Error adding to cart:", err.message);
            throw err;
        }
    }

    async getUserCartWithProductDetails(userId) {
        try {
            // Find the user's cart items
            const user = await UserModel.findById(userId).populate('cart');
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('User not found');
            }

            // For each cart item, find the product details from the respective model
            const cartWithDetails = await Promise.all(user.cart.map(async (cartItem) => {
                const ProductModel = modelMap[cartItem.group];
                if (!ProductModel) {
                    throw new global.DATA.PLUGINS.httperrors.BadRequest("Invalid product group");
                }
                const productDoc = await ProductModel.findOne({ "productId": cartItem.productId, "variants.color.name": cartItem.color.name });
                if (!productDoc) {
                    throw new global.DATA.PLUGINS.httperrors.BadRequest("Product or variant not found");
                }

                const variant = productDoc.variants.find(v => v.color.name === cartItem.color.name);
                const variantSize = variant.variantSizes.find(v => v.size === cartItem.size);

                // Convert to plain JavaScript object
                const productDetails = productDoc.toObject();

                // Removing the specified fields
                delete productDetails.variants;
                delete productDetails.reviews;
                delete productDetails.isDeleted;
                delete productDetails.createdAt;
                delete productDetails.updatedAt;
                delete productDetails.__v;

                if (!variantSize || variantSize.quantity < cartItem.quantityRequired) {
                    return {
                        ...cartItem.toObject(),
                        isRequiredQuantityPresent: false,
                        message: `Insufficient stock for this item, only ${variantSize.quantity} left!`,
                        productDetails
                    };
                } else {
                    return {
                        ...cartItem.toObject(),
                        isRequiredQuantityPresent: true,
                        productDetails
                    };
                }

            }));

            return cartWithDetails;
        } catch (err) {
            console.error("Error retrieving cart items with product details:", err);
            throw err;
        }
    }

    async checkProductQuantity(productDetails, session) {
        try {

            const { group, productId, color, size, quantityRequired } = productDetails

            const ProductModel = modelMap[group];
            if (!ProductModel) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("Invalid product group");
            }

            // Find the product and specific variant
            const productDoc = await ProductModel.findOne({ "productId": productId, "variants.color.name": color });
            if (!productDoc) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("Product or variant not found");
            }

            const variant = productDoc.variants.find(v => v.color.name === color);
            const variantSize = variant.variantSizes.find(v => v.size === size);
            if (!variantSize || variantSize.quantity < quantityRequired) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest(`Insufficient stock for this item, only ${variantSize.quantity} left! But if your required quantity is more than 35, please raise a quote.`);
            }
        } catch (err) {
            console.error("Error updating cart item quantity:", err.message);
            throw err;
        }
    }

    async updateCartItemQuantity(userId, cartItemId, quantityNeedToChange, session) {
        try {

            const user = await UserModel.findById(userId).session(session);
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('User not found');
            }

            // Use the `id` method to find the subdocument in the cart
            const item = user.cart.id(cartItemId);
            if (!item) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('Cart item not found');
            }

            const ProductModel = modelMap[item.group];
            if (!ProductModel) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("Invalid product group");
            }

            // Find the product and specific variant
            const productDoc = await ProductModel.findOne({ "productId": item.productId, "variants.color.name": item.color.name });
            if (!productDoc) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("Product or variant not found");
            }

            const variant = productDoc.variants.find(v => v.color.name === item.color.name);
            const variantSize = variant.variantSizes.find(v => v.size === item.size);
            if (!variantSize || variantSize.quantity < quantityNeedToChange) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest(`Insufficient stock for this item, only ${variantSize.quantity} left!`);
            }

            // Update the quantity directly
            item.quantityRequired = quantityNeedToChange;
            await user.save({ session });

            return item;
        } catch (err) {
            console.error("Error updating cart item quantity:", err.message);
            throw err;
        }
    }

    async updateCartItemCheck(userId, cartItemId, checked, session) {
        try {

            const user = await UserModel.findById(userId).session(session);
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('User not found');
            }

            // Use the `id` method to find the subdocument in the cart
            const item = user.cart.id(cartItemId);
            if (!item) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('Cart item not found');
            }

            // Update the quantity directly
            item.checked = checked;
            await user.save({ session });

            return item;
        } catch (err) {
            console.error("Error in updating cart item check:", err.message);
            throw err;
        }
    }

    async removeCartItem(userId, cartItemId, session) {
        try {
            const user = await UserModel.findById(userId).session(session);
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('User not found');
            }

            // Check if the cart item exists
            const item = user.cart.id(cartItemId);
            if (!item) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('Cart item not found');
            }

            // Remove the item using Mongoose array pull method
            user.cart.pull({ _id: cartItemId });  // _id is used to match the subdocument
            await user.save({ session });

            return { message: "Cart item removed successfully" };
        } catch (err) {
            console.error("Error removing cart item:", err.message);
            throw err;
        }
    }

    async addToWishlist(userId, wishItem, session) {
        try {
            wishItem.color = {
                name: wishItem.color,
                hexcode: colorCodes[wishItem.color] ? colorCodes[wishItem.color] : null
            }

            const user = await UserModel.findById(userId).session(session);
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('User not found');
            }

            // Check if the wishlist item already exists
            const existingItem = user.wishlist.find(item =>
                item.productId === wishItem.productId &&
                item.group === wishItem.group &&
                item.color.name === wishItem.color.name &&
                item.size === wishItem.size
            );

            if (existingItem) {
                // Item exists, do not add again
                throw new global.DATA.PLUGINS.httperrors.BadRequest('Item is already in wishlist');
            } else {
                // New item, add to wishlist
                user.wishlist.push(wishItem);
                await user.save({ session });

                const ProductModel = modelMap[wishItem.group];
                const productDetails = await ProductModel.findOne({ productId: wishItem.productId }).select('-variants -reviews -isDeleted -createdAt -updatedAt -__v');

                // Return only the last item added to the wishlist
                const addedWishlistItem = user.wishlist[user.wishlist.length - 1];
                return { ...addedWishlistItem.toObject(), productDetails };
            }
        } catch (err) {
            console.error("Error adding to wishlist:", err.message);
            throw err;
        }
    }

    async getUserWishlistWithProductDetails(userId) {
        try {
            // Find the user's cart items
            const user = await UserModel.findById(userId).populate('wishlist');
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('User not found');
            }

            // For each cart item, find the product details from the respective model
            const wishlistWithDetails = await Promise.all(user.wishlist.map(async (wishlistItem) => {
                const ProductModel = modelMap[wishlistItem.group];
                if (!ProductModel) {
                    throw new global.DATA.PLUGINS.httperrors.BadRequest("Invalid product group");
                }
                const productDetails = await ProductModel.findOne({ productId: wishlistItem.productId }).select('-variants -reviews -isDeleted -createdAt -updatedAt -__v');
                return {
                    ...wishlistItem.toObject(),
                    productDetails
                };
            }));

            return wishlistWithDetails;
        } catch (err) {
            console.error("Error retrieving wishlist items with product details:", err);
            throw err;
        }
    }

    async removeWishlistItem(userId, wishlistItemId, session) {
        try {
            const user = await UserModel.findById(userId).session(session);
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('User not found');
            }

            // Use the `id` method to find the subdocument in the wishlist
            const item = user.wishlist.id(wishlistItemId);
            if (!item) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest('Wishlist item not found');
            }

            // Remove the item using Mongoose's pull method
            user.wishlist.pull({ _id: wishlistItemId });
            await user.save({ session });

            return { message: "Wishlist item removed successfully" };
        } catch (err) {
            console.error("Error removing wishlist item:", err.message);
            throw err;
        }
    }

    async addProductReview(group, productId, reviewData, session) {

        const ProductModel = modelMap[group];
        if (!ProductModel) {
            throw new global.DATA.PLUGINS.httperrors.BadRequest('Invalid product group');
        }

        const product = await ProductModel.findOne({ productId }).session(session);
        if (!product) {
            throw new global.DATA.PLUGINS.httperrors.BadRequest('Product not found');
        }

        product.reviews.push(reviewData);
        await product.save({ session });

        return product.reviews[product.reviews.length - 1]; // Return the newly added review
    }

    async getProductReviews(group, productId) {

        const ProductModel = modelMap[group];
        if (!ProductModel) {
            throw new Error('Invalid product group');
        }

        const product = await ProductModel.findOne({ productId }).select('reviews');
        if (!product) {
            throw new Error('Product not found');
        }

        return product.reviews;
    }
}

module.exports = UserService;