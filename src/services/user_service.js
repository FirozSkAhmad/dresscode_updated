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
const colorCodes = require('../utils/Helpers/data');

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


    async loginUser(userDetails, session) {
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

            const data = {
                accessToken: accessToken,
                userId: userData._id,
                firstName: userData.firstName
            };

            return data;
        } catch (err) {
            console.error("Error in loginUser with transaction: ", err.message);
            throw err;
        }
    }

    async getUserDetails(userId) {
        try {
            const user = await UserModel.findById(userId, 'firstName lastName email gender phoneNumber');
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

    async enhanceOrderWithProductDetails(order) {
        const modelMap = {
            "HEAL": HealModel,
            "SHIELD": ShieldModel,
            "ELITE": EliteModel,
            "TOGS": TogsModel,
            "SPIRIT": SpiritsModel,
            "WORK WEAR UNIFORMS": WorkWearModel
        };

        const productsWithDetails = await Promise.all(order.products.map(async (product) => {
            const ProductModel = modelMap[product.group];
            if (!ProductModel) {
                throw new Error("Invalid product group");
            }

            const productDetails = await ProductModel.findOne({ productId: product.productId })
                .select('-variants -reviews -isDeleted -createdAt -updatedAt -__v');

            return {
                ...product.toObject(),
                productDetails: productDetails ? productDetails.toObject() : {}
                // Include more complex logic here if needed
            };
        }));

        return productsWithDetails;
    }

    async getUserOrdersWithProductDetails(userId) {
        try {
            const user = await UserModel.findById(userId).populate('orders');

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
            console.error("Error retrieving orders with product and address details:", err);
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

            const modelMap = {
                "HEAL": HealModel,
                "SHIELD": ShieldModel,
                "ELITE": EliteModel,
                "TOGS": TogsModel,
                "SPIRIT": SpiritsModel,
                "WORK WEAR UNIFORMS": WorkWearModel
            };

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

            const modelMap = {
                "HEAL": HealModel,
                "SHIELD": ShieldModel,
                "ELITE": EliteModel,
                "TOGS": TogsModel,
                "SPIRIT": SpiritsModel,
                "WORK WEAR UNIFORMS": WorkWearModel
            };

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
                    logoUrl: addedOrUpdatedCartItem.logoUrl,
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
                    logoUrl: addedOrUpdatedCartItem.logoUrl,
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

            const modelMap = {
                "HEAL": HealModel,
                "SHIELD": ShieldModel,
                "ELITE": EliteModel,
                "TOGS": TogsModel,
                "SPIRIT": SpiritsModel,
                "WORK WEAR UNIFORMS": WorkWearModel
            };

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

            // Find the product and specific variant
            const productDoc = await ProductModel.findOne({ "productId": productId, "variants.color.name": color });
            if (!productDoc) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("Product or variant not found");
            }

            const variant = productDoc.variants.find(v => v.color.name === color);
            const variantSize = variant.variantSizes.find(v => v.size === size);
            if (!variantSize || variantSize.quantity < quantityRequired) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest(`Insufficient stock for this item, only ${variantSize.quantity} left!`);
            }
        } catch (err) {
            console.error("Error updating cart item quantity:", err.message);
            throw err;
        }
    }

    async updateCartItemQuantity(userId, cartItemId, quantityNeedToChange, session) {
        try {
            const modelMap = {
                "HEAL": HealModel,
                "SHIELD": ShieldModel,
                "ELITE": EliteModel,
                "TOGS": TogsModel,
                "SPIRIT": SpiritsModel,
                "WORK WEAR UNIFORMS": WorkWearModel
            };

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

                const modelMap = {
                    "HEAL": HealModel,
                    "SHIELD": ShieldModel,
                    "ELITE": EliteModel,
                    "TOGS": TogsModel,
                    "SPIRIT": SpiritsModel,
                    "WORK WEAR UNIFORMS": WorkWearModel
                };

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

            const modelMap = {
                "HEAL": HealModel,
                "SHIELD": ShieldModel,
                "ELITE": EliteModel,
                "TOGS": TogsModel,
                "SPIRIT": SpiritsModel,
                "WORK WEAR UNIFORMS": WorkWearModel
            };

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