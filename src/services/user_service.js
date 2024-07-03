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

class UserService {
    constructor() {
        this.UserModel = UserModel;
        this.jwtObject = new JWTHelper();
    }

    async createUser(userDetails) {
        // const session = await mongoose.startSession();
        // session.startTransaction();
        try {
            const { firstName, lastName, email, gender, phoneNumber, password } = userDetails;
            let errors = [];

            // Validate availability of email and phone number simultaneously
            const [existingUserEmail, existingUserPhone] = await Promise.all([
                UserModel.findOne({ email: email.toLowerCase() }),//.session(session)
                UserModel.findOne({ phoneNumber })//.session(session)
            ]);

            if (existingUserEmail) {
                errors.push("Email address already in use");
            }
            if (existingUserPhone) {
                errors.push("Phone number already in use");
            }

            // If any errors, throw them all at once
            if (errors.length > 0) {
                throw new Error(errors.join(", "));
            }

            // Hash the password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Prepare the user payload
            const userPayload = {
                firstName,
                lastName,
                email: email.toLowerCase(),  // Ensure the email is stored in lowercase
                gender: gender.toUpperCase(),
                phoneNumber,
                password: hashedPassword
            };

            // Create the new user
            const newUser = await UserModel.create(userPayload)//, { session: session };

            // await session.commitTransaction();
            // session.endSession();
            return newUser;
        } catch (err) {
            // await session.abortTransaction();
            // session.endSession();
            console.error("Error in createUser: ", err);
            throw new Error(err.message || "An internal server error occurred");
        }
    }

    async loginUser(userDetails) {
        try {

            // Find user by email using findOne() with async/await
            const userData = await UserModel.findOne({
                email_id: userDetails.email_id
            });

            if (!userData) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("No user exists with given emailId");
            }

            // Validate password using bcrypt.compare()
            const isValid = await bcrypt.compare(userDetails.password, userData.password);
            if (!isValid) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("Incorrect Password");
            }

            // Valid email and password - generate access token
            const tokenPayload = userData._id + ":" + userData.firstName;
            const accessToken = await this.jwtObject.generateAccessToken(tokenPayload);

            // Prepare response data (excluding sensitive fields)
            const data = {
                accessToken: accessToken,
                userId: userData._id,
                firstName: userData.firstName
            };

            return data;
        } catch (err) {
            console.error("Error in loginUser: ", err.message);

            // Handle different error types based on specific messages
            if (err instanceof global.DATA.PLUGINS.httperrors.HttpError) {
                // Return specific HTTP status and message set by your custom error class
                return { status: err.statusCode, message: err.message };
            } else {
                // Internal server error (generic)
                console.error("Internal server error:", err);
                return { status: 500, message: "Internal server error" };
            }
        }
    }

    async updateUserDetails(userId, updates) {
        try {
            // Fetch user by ID
            const user = await UserModel.findById(userId);
            if (!user) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("User not found");
            }

            // Update user details
            user.firstName = updates.firstName || user.firstName;
            user.lastName = updates.lastName || user.lastName;
            user.email = updates.email || user.email;
            user.phoneNumber = updates.phoneNumber || user.phoneNumber;
            user.gender = updates.gender || user.gender;

            // Save the updated user info
            await user.save();

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

            // Handle specific known errors
            if (err instanceof global.DATA.PLUGINS.httperrors.HttpError) {
                return { status: err.statusCode, message: err.message };
            } else {
                // Internal server error (generic)
                return { status: 500, message: "Internal server error" };
            }
        }
    }


    async addAddress(userId, newAddress) {
        try {
            // Fetch the user by ID
            const user = await this.UserModel.findById(userId);
            if (!user) {
                throw new Error("User not found");
            }

            if (newAddress.markAsDefault) {
                if (newAddress.markAsDefault === true) {
                    user.addresses.forEach(addr => addr.markAsDefault = false);
                }
            }

            // Add the new address which may or may not be marked as default
            user.addresses.push(newAddress);

            // Save the user with the updated address list
            const updatedUser = await user.save();

            // Return only the newly added address (it will be the last one in the array)
            const addedAddress = updatedUser.addresses[updatedUser.addresses.length - 1];
            return addedAddress;
        } catch (err) {
            console.error("Error adding address:", err.message);
            throw err; // Rethrow the error to be handled by the caller
        }
    }

    // In UserService.js
    async updateAddress(userId, addressId, addressUpdates) {
        try {
            // Find the user
            const user = await this.UserModel.findById(userId);
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
            }

            // Find the specific address by ID
            const addressToUpdate = user.addresses.id(addressId);
            if (!addressToUpdate) {
                throw global.DATA.PLUGINS.httperrors.BadRequest("Address not found");
            }

            // Update the fields provided in addressUpdates
            Object.assign(addressToUpdate, addressUpdates);

            // Save the user object after modifications
            const updatedUser = await user.save();

            // Return only the updated address
            return updatedUser.addresses.id(addressId);
        } catch (err) {
            console.error("Error updating address:", err.message);
            throw err;
        }
    }

    async setDefaultAddress(userId, addressId) {
        try {
            // First, set all addresses' markAsDefault to false
            await this.UserModel.updateOne(
                { _id: userId },
                { $set: { "addresses.$[].markAsDefault": false } }
            );

            // Then, set the specified address's markAsDefault to true
            const result = await this.UserModel.updateOne(
                { _id: userId, "addresses._id": addressId },
                { $set: { "addresses.$.markAsDefault": true } }
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

    async deleteAddress(userId, addressId) {
        try {
            // Fetch the user and update the isDeleted flag for the specific address
            const user = await this.UserModel.findOneAndUpdate(
                { "_id": userId, "addresses._id": addressId },
                { "$set": { "addresses.$.isDeleted": true } },
                { new: true }
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
            const activeAddresses = user.addresses.filter(addr => !addr.isDeleted);
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

    // async getUserOrders(userId) {
    //     try {
    //         const modelMap = {
    //             "HEAL": HealModel,
    //             "SHIELD": ShieldModel,
    //             "ELITE": EliteModel,
    //             "TOGS": TogsModel,
    //             "SPIRIT": SpiritsModel,
    //             "WORK WEAR UNIFORMS": WorkWearModel
    //         };

    //         // Retrieve the appropriate model based on the group provided.
    //         const ProductModel = modelMap[group];
    //         if (!ProductModel) {
    //             // Throw an error if the group is not recognized (no matching model).
    //             throw new global.DATA.PLUGINS.httperrors("Invalid product group");
    //         }

    //         try {
    //             // Perform a database query to find all products in the specified group that are not deleted.
    //             // Exclude variants and reviews from the returned documents for a cleaner response.
    //             const products = await ProductModel.find({ isDeleted: false })
    //                                                 .select('-variants -reviews')
    //                                                 .exec();

    //             // Return the fetched products.
    //             return products;
    //         // Assuming that orders are stored under a user's document
    //         const userWithOrders = await UserModel.findById(userId).populate('orders').exec();
    //         if (!userWithOrders) {
    //             throw new global.DATA.PLUGINS.httperrors.BadRequest('User not found');
    //         }
    //         return userWithOrders.orders;
    //     } catch (err) {
    //         console.error("Error retrieving user orders:", err.message);
    //         throw err;
    //     }
    // }

    async getUserOrdersWithProductDetails(userId) {
        try {
            // Find the user's orders
            const user = await UserModel.findById(userId).populate('orders');
            if (!user) {
                throw new Error('User not found');
            }

            const modelMap = {
                "HEAL": HealModel,
                "SHIELD": ShieldModel,
                "ELITE": EliteModel,
                "TOGS": TogsModel,
                "SPIRIT": SpiritsModel,
                "WORK WEAR UNIFORMS": WorkWearModel
            };

            // For each order, find the product details from the respective model
            const ordersWithDetails = await Promise.all(user.orders.map(async (order) => {
                const ProductModel = modelMap[order.group];
                if (!ProductModel) {
                    throw new global.DATA.PLUGINS.httperrors.BadRequest("Invalid product group");
                }
                const productDetails = await ProductModel.findOne({ productId: order.productId }).select('-variants -reviews -isDeleted -createdAt -updatedAt -__v');
                return {
                    ...order.toObject(),
                    productDetails
                };
            }));

            return ordersWithDetails;
        } catch (err) {
            console.error("Error retrieving orders with product details:", err);
            throw err;
        }
    }

}
module.exports = UserService;