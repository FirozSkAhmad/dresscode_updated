const Store = require('../utils/Models/storeModel');
const mongoose = require('mongoose');
const JWTHelper = require('../utils/Helpers/jwt_helper')
const bcrypt = require('bcrypt');

class StoreService {
    constructor() {
        this.jwtObject = new JWTHelper();
    }

    // Create Store Service
    async createStore(storeData) {
        // Check if userName, phoneNo, or emailID already exists
        const existingStore = await Store.findOne({
            $or: [
                { userName: storeData.userName },
                { phoneNo: storeData.phoneNo },
                { emailID: storeData.emailID }
            ]
        });

        if (existingStore) {
            throw new Error('User Name, Phone No, or Email ID already exists.');
        }

        // Hash the password before saving
        // const hashedPassword = await bcrypt.hash(storeData.password, 10);

        // Create the store object
        const newStore = new Store({
            storeName: storeData.storeName,
            storeAddress: storeData.storeAddress,
            city: storeData.city,
            pincode: storeData.pincode,
            state: storeData.state,
            commissionPercentage: storeData.commissionPercentage,
            userName: storeData.userName,
            phoneNo: storeData.phoneNo,
            emailID: storeData.emailID,
            password: storeData.password
        });

        // Save the store in the database
        return await newStore.save();
    };

    async loginUser(userDetails, session, res) {
        try {
            const userData = await Store.findOne({ emailID: userDetails.emailID }).session(session);

            if (!userData) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("No user exists with given emailID");
            }

            if (userDetails.password !== userData.password) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("Incorrect Password");
            }

            // If you need to update last login time or log the login attempt
            await Store.updateOne(
                { _id: userData._id },
                { $set: { lastLogin: new Date() } },
                { session: session }
            );

            const tokenPayload = `${userData._id}:${userData.roleType}:${userData.userName}`;
            const accessToken = await this.jwtObject.generateAccessToken(tokenPayload);
            const refreshToken = await this.jwtObject.generateRefreshToken(tokenPayload);

            // Set the refresh token in an HTTP-only cookie
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,    // Prevents JavaScript from accessing the cookie
                secure: true, // Required when sameSite is 'None'
                sameSite: 'None',
                path: '/'
            });

            const data = {
                accessToken: accessToken,
                userId: userData._id,
                name: userData.name,
                emailID: userData.emailID,
                phoneNumber: userData.phoneNumber,
            };

            return data;
        } catch (err) {
            console.error("Error in loginUser with transaction: ", err.message);
            throw err;
        }
    }

    // Method to get all store names
    async getAllStoreNames() {
        try {
            // Use Mongoose to find all stores and select only the storeName field
            const stores = await Store.find({}, 'storeName').lean();
            // Extract the store names into an array of strings
            const storeNames = stores.map(store => store.storeName);
            return storeNames;
        } catch (error) {
            // Handle and rethrow the error for the controller to catch
            throw new Error('Error fetching store names: ' + error.message);
        }
    }
}

module.exports = StoreService;
