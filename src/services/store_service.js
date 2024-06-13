const Store = require('../models/StoreModel'); // Import the Store model
const User = require('../models/UserModel'); // Import the User model
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

class StoreService {
    constructor() { }

    async createStore(storeDetails) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { storeName, storeAddress, city, pincode, state, commissionPersentage, email_id, password, user_name, phn_no } = storeDetails;

            // Check for existing user details
            const existingUserName = await User.findOne({ user_name }).session(session);
            if (existingUserName) {
                throw new Error("Given user name is already in use");
            }

            const existingUser = await User.findOne({ email_id }).session(session);
            if (existingUser) {
                throw new Error("Email ID already in use");
            }

            // Hash the password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Create the new user
            const newUser = new User({
                user_name,
                email_id,
                password: hashedPassword,
                phn_no,
                role_type: "WAREHOUSE MANAGER", // Assuming role based on store creation context
                date_of_signUp: new Date().toISOString().slice(0, 10)
            });

            await newUser.save({ session });

            // Check for existing store with the same name or address
            const existingStore = await Store.findOne({ storeName, storeAddress }).session(session);
            if (existingStore) {
                throw new Error("Store with given name and address already exists");
            }

            // Create the new store
            const newStore = new Store({
                storeName,
                storeAddress,
                city,
                pincode,
                state,
                commissionPersentage,
                userId: newUser._id // Linking the new user to the new store
            });

            await newStore.save({ session });

            // Commit transaction
            await session.commitTransaction();
            session.endSession();
            return newStore;
        } catch (err) {
            // Abort transaction on error
            await session.abortTransaction();
            session.endSession();
            console.error("Error in createStore: ", err);
            throw new Error("Failed to create store: " + err.message);
        }
    }

    async getStoreNamesAndIds() {
        try {
            const stores = await Store.find({}, 'storeName _id').lean();  // Only fetch store names and IDs
            return { status: 'success', data: stores };
        } catch (error) {
            console.error('Failed to retrieve stores:', error);
            return { status: 'error', message: 'Failed to retrieve stores', error: error.message };
        }
    }

    async getStoreDetails(storeId) {
        try {
            const storeDetails = await Store.findById(storeId)
                .populate('userId', 'user_name email_id phn_no -_id')
                .lean();

            if (!storeDetails) {
                return res.status(404).json({ status: 'error', message: 'Store not found' });
            }

            return { status: 'success', data: storeDetails };
        } catch (error) {
            console.error('Failed to retrieve stores:', error);
            return { status: 'error', message: 'Failed to retrieve stores', error: error.message };
        }
    }

    async getStoreInventory(storeId) {
        try {
            const store = await Store.findById(storeId)
                .populate({
                    path: 'productVariants.productId',
                    populate: {
                        path: 'variants.variantId',
                        model: 'Variant'
                    }
                })
                .exec();

            if (!store) {
                return { status: 'error', message: 'Store not found' };
            }

            const inventory = store.productVariants.flatMap(pv => {
                return pv.variantIdsQunatity.map(viq => {
                    const variantDetail = store.productId.variants.find(v => v._id.equals(viq.variantId));
                    return {
                        productId: pv.productId.productId,
                        productName: pv.productId.productName,
                        gender: pv.productId.gender,
                        productCategory: pv.productId.productCategory,
                        pattern: pv.productId.pattern || 'N/A',
                        color: variantDetail.color,
                        size: variantDetail.size,
                        quantity: viq.quantity,
                        price: variantDetail.price
                    };
                });
            });

            return { status: 'success', data: inventory };
        } catch (error) {
            console.error('Failed to retrieve store inventory:', error);
            return { status: 'error', message: 'Failed to retrieve store inventory', error: error.message };
        }
    }
}

module.exports = StoreService;
