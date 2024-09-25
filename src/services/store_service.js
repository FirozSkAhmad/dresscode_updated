const Store = require('../utils/Models/storeModel');
const AssignedInventory = require('../utils/Models/assignedInventoryModel');
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

            const tokenPayload = `${userData.storeId}:${userData.roleType}:${userData.userName}`;
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
    async getAllStoreNameAndIds() {
        try {
            // Use Mongoose to find all stores and select only the storeName field
            const stores = await Store.find({}, 'storeName storeId').lean();
            // Extract the store names into an array of strings
            const storeNameandIds = stores.map(store => { store.storeName, store.storeId });
            return storeNameandIds;
        } catch (error) {
            // Handle and rethrow the error for the controller to catch
            throw new Error('Error fetching store names: ' + error.message);
        }
    }

    validateData(data, rowNumber) {
        // required fields
        const requiredFields = ['productId', 'groupName', 'categoryName', 'subCategoryName', 'gender', 'productType', 'fit', 'neckline', 'pattern', 'sleeves', 'material', 'variantColor', 'hexcode', 'variantSize', 'variantQuantity', 'styleCoat', 'sku', 'price', 'productDescription', 'sizeChart', 'variantImages'];

        for (let field of requiredFields) {
            if (!data[field]) {
                throw new Error(`Missing required field:${field} in CSV file at row ${rowNumber}.`);
            }
        }
    }

    assembleValidatedData(data) {
        const baseData = {
            productId: data.productId,
            group: data.groupName.trim().toUpperCase(),
            category: data.categoryName.trim().toUpperCase(),
            subCategory: data.subCategoryName.trim().toUpperCase(),
            gender: data.gender.trim().toUpperCase(),
            productType: data.productType.trim().toUpperCase(),
            price: parseFloat(data.price) || 0,
            productDescription: data.productDescription.trim(),
            fit: data.fit.trim().toUpperCase(),
            neckline: data.neckline.trim().toUpperCase(),
            pattern: data.pattern.trim().toUpperCase(),
            sleeves: data.sleeves.trim().toUpperCase(),
            material: data.material.trim().toUpperCase(),
            sizeChart: data.sizeChart.trim(),
            variant: {
                color: {
                    name: data.variantColor.trim().toUpperCase(),
                    hexcode: data.hexcode.trim()
                },
                variantSizes: [{
                    size: data.variantSize.trim().toUpperCase(),
                    quantity: parseInt(data.variantQuantity, 10) || 0,
                    sku: data.sku.trim(),
                    styleCoat: data.styleCoat.trim(),
                }],
                imageUrls: data.variantImages ? data.variantImages.split(';').map(url => url.trim()) : []
            }
        };
        return baseData;
    }

    async processCsvFile(buffer, storeId) {
        try {

            // Check if the store exists
            const existingStore = await Store.findById(storeId);
            if (!existingStore) {
                throw new Error("Store not found. Please provide a valid store ID.")
            }
            let data = await this.parseCsv(buffer);
            let products = []; // Local products array
            for (const item of data) {
                this.addVariant(item, products); // Call the specific function based on the group  
            }
            // Create AssignedInventory document
            await this.createAssignedInventory(storeId, products);
            return { status: 200, message: "Products assigined successfully." };
        } catch (error) {
            throw new Error(error.message);
        }
    }

    parseCsv(buffer) {
        return new Promise((resolve, reject) => {
            const results = [];
            const bufferStream = new stream.PassThrough();
            bufferStream.end(buffer);
            let errorOccurred = false;
            let rowNumber = 1; // Initialize row counter

            bufferStream
                .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
                .on('data', (data) => {
                    if (errorOccurred) return; // Early return if an error has already occurred
                    rowNumber++; // Increment row counter for each row processed

                    try {
                        this.validateData(data, rowNumber);
                        const validatedData = this.assembleValidatedData(data);
                        results.push(validatedData);
                    } catch (error) {
                        errorOccurred = true; // Flag that an error occurred
                        bufferStream.unpipe(); // Optionally unpipe to stop processing
                        reject(error);
                    }
                })
                .on('end', () => {
                    if (!errorOccurred) {
                        resolve(results);
                    }
                })
                .on('error', (error) => {
                    console.error(`Stream error: ${error.message}`);
                    reject(error);
                });
        });
    }

    addVariant(item, products) {
        try {

            // Check if the product already exists in the local 'products' array
            let existingProduct = products.find(product => product.productId === item.productId);

            if (existingProduct) {
                const variant = existingProduct.variants.find(v => v.color.name === item.variant.color.name);
                if (variant) {
                    const sizeDetail = variant.variantSizes.find(v => v.size === item.variant.variantSizes[0].size);
                    if (sizeDetail) {
                        sizeDetail.quantity += item.variant.variantSizes[0].quantity;
                    } else {
                        variant.variantSizes.push(item.variant.variantSizes[0]);
                    }
                } else {
                    existingProduct.variants.push(item.variant);
                }
            } else {
                // Product doesn't exist locally; add it to the 'products' array
                let newProduct = {
                    ...item, // Copy all item properties
                    variants: [item.variant]
                };
                products.push(newProduct);
            }
        } catch (error) {
            console.error(`Error adding variant to product:`, error.message);
            throw new Error(`Failed to add or update variant`);
        }
    }

    async createAssignedInventory(storeId, products) {
        try {
            // Calculate total amount assigned
            let totalAmount = products.reduce((sum, product) => {
                let productTotal = product.variants.reduce((variantSum, variant) => {
                    let variantTotal = variant.variantSizes.reduce((sizeSum, size) => {
                        const quantity = size.quantity || 0;
                        const price = product.price || 0;
                        return sizeSum + (quantity * price);
                    }, 0);
                    return variantSum + variantTotal;
                }, 0);
                return sum + productTotal;
            }, 0);

            // Prepare the assignedInventory data
            const assignedInventoryData = {
                storeId: storeId,
                assignedDate: new Date(),
                totalAmountOfAssigned: totalAmount,
                status: 'ASSIGNED',
                products: products
            };

            // Save to AssignedInventory collection
            await AssignedInventory.create(assignedInventoryData);
        } catch (error) {
            console.error("Error creating assigned inventory:", error.message);
            throw new Error(`Failed to create assigned inventory`);
        }
    }

    async receiveInventory(assignedInventoryId, roleType, userStoreId) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {

            // Get the assigned inventory using assignedInventoryId
            const assignedInventory = await AssignedInventory.findOne({ assignedInventoryId }).session(session);

            if (!assignedInventory) {
                throw new Error("Assigned Inventory not found.");
            }

            // If the user is a STORE MANAGER, ensure they are associated with the correct store
            if (roleType === 'STORE MANAGER' && assignedInventory.storeId !== userStoreId) {
                throw new Error("Forbidden. You are not authorized to receive this inventory.");
            }

            // Check if the inventory has already been received
            if (assignedInventory.status === 'RECEIVED') {
                throw new Error("Inventory has already been received.");
            }

            // Update assignedInventory status and receivedDate
            assignedInventory.status = 'RECEIVED';
            assignedInventory.receivedDate = new Date();
            await assignedInventory.save({ session });

            // Get the store
            const store = await Store.findOne({ storeId: assignedInventory.storeId }).session(session);

            if (!store) {
                throw new Error("Store not found.");
            }

            // Update store's products
            for (let assignedProduct of assignedInventory.products) {
                // Find the product in store's products
                let storeProduct = store.products.find(p => p.productId === assignedProduct.productId);

                if (storeProduct) {
                    // Product exists, update variants
                    for (let assignedVariant of assignedProduct.variants) {
                        let storeVariant = storeProduct.variants.find(v => v.color.name === assignedVariant.color.name);

                        if (storeVariant) {
                            // Variant exists, update sizes
                            for (let assignedSize of assignedVariant.variantSizes) {
                                let storeSize = storeVariant.variantSizes.find(s => s.size === assignedSize.size);

                                if (storeSize) {
                                    // Size exists, increase quantity
                                    storeSize.quantity += assignedSize.quantity;
                                } else {
                                    // Size doesn't exist, add it
                                    storeVariant.variantSizes.push(assignedSize);
                                }
                            }
                        } else {
                            // Variant doesn't exist, add it
                            storeProduct.variants.push(assignedVariant);
                        }
                    }
                } else {
                    // Product doesn't exist, add it
                    store.products.push(assignedProduct);
                }
            }

            // Save the store
            await store.save({ session });

            // Commit transaction
            await session.commitTransaction();
            session.endSession();

            return {
                status: 200,
                message: "Inventory received and store updated successfully."
            };
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            console.error("Error while receiving inventory:", err.message);
            throw err;
        }
    }

    async getStoreDetails(storeId) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            // Get the store using storeId
            const storeDetails = await Store.findOne({ storeId: storeId }).session(session);

            if (!storeDetails) {
                throw new Error("Store not found.");
            }

            // Commit transaction
            await session.commitTransaction();
            session.endSession();

            return {
                status: 200,
                message: "Store details retrieved successfully.",
                data: {
                    storeName: storeDetails.storeName,
                    storeId: storeDetails.storeId,
                    storeAddress: storeDetails.storeAddress,
                    city: storeDetails.city,
                    pincode: storeDetails.pincode,
                    state: storeDetails.state,
                    userName: storeDetails.userName,
                    phoneNo: storeDetails.phoneNo,
                    emailID: storeDetails.emailID
                }
            };
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            console.error("Error while retrieving store details:", err.message);
            throw err.message;
        }
    }

    async getAssignedInventories() {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            // Fetch all assigned inventories and select specific fields
            const assignedInventories = await AssignedInventory.find({}, 'assignedInventoryId assignedDate receivedDate status totalAmountOfAssigned').exec();

            if (assignedInventories) {
                const formattedData = assignedInventories.map(inv => ({
                    assignedInventoryId: inv.assignedInventoryId,
                    DateOfAssigned: inv.assignedDate.toLocaleDateString("en-US"),
                    DateOfReceived: inv.receivedDate ? inv.receivedDate : '----------',
                    Status: inv.status,
                    TotalAmount: inv.totalAmountOfAssigned
                }));

                res.json({
                    success: true,
                    data: formattedData
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'No assigned inventories found'
                });
            }
        } catch (error) {
            console.error("Error while retrieving assigned inventories:", error);
            throw new Error("Server error.");;
        }
    }

}

module.exports = StoreService;
