const Store = require('../utils/Models/storeModel');
const AssignedInventory = require('../utils/Models/assignedInventoryModel');
const RaisedInventory = require('../utils/Models/raisedInventoryModel');
const Counter = require('../utils/Models/counterModel');
const Customer = require('../utils/Models/customerModel');
const Bill = require('../utils/Models/billingModel');
const OldBill = require('../utils/Models/oldBillModel');
const BillEditReq = require('../utils/Models/billEditReqModel');
const Togs = require('../utils/Models/togsModel');
const mongoose = require('mongoose');
const JWTHelper = require('../utils/Helpers/jwt_helper')
const bcrypt = require('bcrypt');
const stream = require('stream');
const csv = require('csv-parser');
const csvWriter = require('csv-writer').createObjectCsvStringifier; // Import csv-writer

class StoreService {
    constructor() {
        this.jwtObject = new JWTHelper();
    }

    // Create Store Service
    async createStore(storeData) {
        // Check if userName, phoneNo, or emailID already exists
        const existingStore = await Store.findOne({
            $or: [
                { storeName: storeData.storeName },
                { userName: storeData.userName },
                { phoneNo: storeData.phoneNo },
                { emailID: storeData.emailID }
            ]
        });

        if (existingStore) {
            throw new Error('storeName, User Name, Phone No, or Email ID already exists.');
        }

        // Hash the password before saving
        // const hashedPassword = await bcrypt.hash(storeData.password, 10);

        // Create the store object
        const newStore = new Store({
            storeName: storeData.storeName.toUpperCase(),
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

    // Service for updating store
    async updateStore(storeId, updateFields) {
        // Validate if the fields provided are unique
        if (updateFields.storeName || updateFields.userName || updateFields.phoneNo || updateFields.emailID) {
            const existingStore = await Store.findOne({
                $or: [
                    { storeName: updateFields.storeName },
                    { userName: updateFields.userName },
                    { phoneNo: updateFields.phoneNo },
                    { emailID: updateFields.emailID }
                ],
                _id: { $ne: storeId } // Exclude the current store being updated
            });

            if (existingStore) {
                return {
                    statusCode: 400,
                    success: false,
                    message: 'storeName, User Name, Phone No, or Email ID already exists.'
                };
            }
        }

        // Update store data
        const updatedStore = await Store.findOneAndUpdate(
            { storeId },
            {
                ...updateFields,
                ...(updateFields.storeName && { storeName: updateFields.storeName.toUpperCase() }) // Convert storeName to uppercase if provided
            },
            { new: true } // Return the updated document
        );

        if (!updatedStore) {
            return {
                statusCode: 404,
                success: false,
                message: 'Store not found.'
            };
        }

        return {
            success: true,
            statusCode: 200,
            store: updatedStore
        };
    }


    async loginUser(userDetails, session, res) {
        try {
            const storeData = await Store.findOne({ emailID: userDetails.emailID }).session(session);

            if (!storeData) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("No user exists with given emailID");
            }

            if (userDetails.password !== storeData.password) {
                throw new global.DATA.PLUGINS.httperrors.BadRequest("Incorrect Password");
            }

            // If you need to update last login time or log the login attempt
            await Store.updateOne(
                { _id: storeData._id },
                { $set: { lastLogin: new Date() } },
                { session: session }
            );

            const tokenPayload = `${storeData.storeId}:${storeData.roleType}:${storeData.userName}`;
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
                storeId: storeData.storeId,
                storeName: storeData.storeName,
                userName: storeData.userName,
                emailID: storeData.emailID,
                phoneNo: storeData.phoneNo,
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
            // Extract the store names and IDs into an array of objects
            const storeNameAndIds = stores.map(store => ({
                storeName: store.storeName,
                storeId: store.storeId
            }));

            return storeNameAndIds;
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
                imageUrls: data.variantImages ? data.variantImages.split(';').map(url => url.trim()) : [],
                variantId: data.variantId
            }
        };
        return baseData;
    }

    async processCsvFile(buffer, storeId, storeName, typeOfRequest) {
        try {

            // Check if the store exists
            const existingStore = await Store.findOne({ storeId });
            if (!existingStore) {
                throw new Error("Store not found. Please provide a valid store ID.")
            }
            let data = await this.parseCsv(buffer);
            let products = []; // Local products array
            for (const item of data) {
                this.addVariant(item, products); // Call the specific function based on the group  
            }
            if (!typeOfRequest) {
                // Create AssignedInventory document
                await this.createAssignedInventory(storeId, products);
            }
            else {
                await this.createRaisedInventory(storeId, storeName, products);
            }
            return { status: 200, message: "Inventory request raised successfully." };
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
                    // Loop through all sizes in the item's variantSizes array
                    item.variant.variantSizes.forEach(newSizeDetail => {
                        const existingSizeDetail = variant.variantSizes.find(v => v.size === newSizeDetail.size);
                        if (existingSizeDetail) {
                            existingSizeDetail.quantity += newSizeDetail.quantity;
                        } else {
                            variant.variantSizes.push(newSizeDetail);
                        }
                    });
                } else {
                    // Variant doesn't exist, so add the entire variant to the existing product
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
            let totalAmount = 0;
            const inventoryCheckTasks = [];

            // Find the store by storeId and project only the storeName field
            const store = await Store.findOne({ storeId }, 'storeName').exec();

            if (!store) {
                return { status: 404, message: "Store not found" };
            }

            // Prepare to verify all inventory before committing any changes
            for (const product of products) {
                inventoryCheckTasks.push((async () => {
                    const insufficientStockErrors = [];
                    const togsProduct = await Togs.findOne({ productId: product.productId, schoolName: store.storeName }).exec();

                    if (!togsProduct) {
                        insufficientStockErrors.push({ productId: product.productId, message: `Product not found in ${store.storeName} Togs.` });
                        return { errors: insufficientStockErrors };
                    }

                    product.variants.forEach(variant => {
                        const togsVariant = togsProduct.variants.find(v => v.color.name === variant.color.name && v.color.hexcode === variant.color.hexcode);
                        if (!togsVariant) {
                            insufficientStockErrors.push({ productId: product.productId, variantId: variant.variantId, message: "Variant not found in Togs." });
                            return;
                        }

                        variant.variantSizes.forEach(sizeDetail => {
                            const togsSizeDetail = togsVariant.variantSizes.find(v => v.size === sizeDetail.size);
                            if (!togsSizeDetail || togsSizeDetail.quantity < sizeDetail.quantity) {
                                insufficientStockErrors.push({
                                    productId: product.productId,
                                    variantId: variant.variantId,
                                    size: sizeDetail.size,
                                    requiredQuantity: sizeDetail.quantity,
                                    availableQuantity: togsSizeDetail ? togsSizeDetail.quantity : 0,
                                    message: "Insufficient stock for size."
                                });
                            } else {
                                // Calculate total assuming decrement will be successful
                                totalAmount += sizeDetail.quantity * product.price;
                            }
                        });
                    });

                    return {
                        product,
                        togsProduct,
                        errors: insufficientStockErrors
                    };
                })());
            }

            // Resolve all inventory check tasks
            const inventoryChecks = await Promise.all(inventoryCheckTasks);
            const aggregatedErrors = inventoryChecks.flatMap(check => check.errors || []);

            // If there were inventory issues, do not proceed with any updates
            if (aggregatedErrors.length > 0) {
                throw new Error(JSON.stringify(aggregatedErrors));
            }

            // If all checks pass, then proceed to update the quantities
            for (const check of inventoryChecks) {
                check.product.variants.forEach(variant => {
                    const togsVariant = check.togsProduct.variants.find(v => v.color.name === variant.color.name && v.color.hexcode === variant.color.hexcode);
                    variant.variantSizes.forEach(sizeDetail => {
                        const togsSizeDetail = togsVariant.variantSizes.find(v => v.size === sizeDetail.size);
                        togsSizeDetail.quantity -= sizeDetail.quantity; // Safe to update now
                    });
                });
                await check.togsProduct.save(); // Commit the changes to the database
            }

            // Everything is okay; prepare and save the assigned inventory
            const assignedInventoryData = {
                storeId: storeId,
                assignedDate: new Date(),
                totalAmountOfAssigned: totalAmount,
                status: 'ASSIGNED',
                products: products
            };

            await AssignedInventory.create(assignedInventoryData);
            return { status: 200, message: "Assigned inventory created and quantities updated in Togs." };
        } catch (error) {
            console.error("Error during inventory assignment and update:", error.message);
            throw new Error(error.message)
        }
    }


    async createRaisedInventory(storeId, storeName, products) {
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
            const raisedInventoryData = {
                storeId: storeId,
                storeName: storeName,
                raisedDate: new Date(),
                totalAmountRaised: totalAmount,
                status: 'PENDING',
                products: products
            };

            // Save to AssignedInventory collection
            await RaisedInventory.create(raisedInventoryData);
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
            const storeDetails = await Store.findOne({ storeId }).session(session);

            if (!storeDetails) {
                throw new Error("Store not found.");
            }

            // Aggregating the total billed amount, number of active bills, and number of deleted bills
            const result = await Bill.aggregate([
                { $match: { storeId } }, // Match bills by storeId
                {
                    $group: {
                        _id: null, // No specific field to group by
                        totalBilledAmount: {
                            $sum: {
                                $cond: [{ $eq: ["$isDeleted", false] }, "$priceAfterDiscount", 0]
                            }
                        }, // Sum priceAfterDiscount for non-deleted bills
                        activeBillCount: {
                            $sum: { $cond: [{ $eq: ["$isDeleted", false] }, 1, 0] }
                        }, // Count active bills
                        deletedBillCount: {
                            $sum: { $cond: [{ $eq: ["$isDeleted", true] }, 1, 0] }
                        } // Count deleted bills
                    }
                }
            ]);

            // Extracting the values, defaulting to 0 if no matching documents are found
            const { totalBilledAmount = 0, activeBillCount = 0, deletedBillCount = 0 } = result.length > 0 ? result[0] : {};

            // Calculate commission earned
            const commissionPercentage = storeDetails.commissionPercentage || 0;
            const commissionEarned = (totalBilledAmount * commissionPercentage) / 100;

            const storeOverview = {
                storeId,
                totalBilledAmount,
                activeBillCount,
                deletedBillCount,
                commissionPercentage,
                commissionEarned
            };

            // Commit transaction
            await session.commitTransaction();
            return {
                status: 200,
                message: "Store details retrieved successfully.",
                data: {
                    storeOverview,
                    storeName: storeDetails.storeName,
                    storeAddress: storeDetails.storeAddress,
                    city: storeDetails.city,
                    pincode: storeDetails.pincode,
                    state: storeDetails.state,
                    userName: storeDetails.userName,
                    phoneNo: storeDetails.phoneNo,
                    emailID: storeDetails.emailID,
                    password: storeDetails.password
                }
            };
        } catch (err) {
            await session.abortTransaction();
            console.error("Error while retrieving store details:", err.message);
            throw err; // Throw the full error, not just the message
        } finally {
            session.endSession(); // Ensure session is always ended
        }
    }

    async getAssignedInventoriesByStore(storeId) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const assignedInventories = await AssignedInventory.find({ storeId: storeId }, 'assignedInventoryId assignedDate receivedDate status totalAmountOfAssigned').sort({ assignedDate: -1 })
                .exec();

            if (assignedInventories.length === 0) {
                console.log('No assigned inventories found for the given storeId.');
                return []
            }

            const formattedData = assignedInventories.map(inv => ({
                assignedInventoryId: inv.assignedInventoryId,
                assignedDate: inv.assignedDate,
                receivedDate: inv.receivedDate,
                status: inv.status,
                totalAmountOfAssigned: inv.totalAmountOfAssigned
            }));

            await session.commitTransaction();
            session.endSession();

            return formattedData
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.error("Error while retrieving assigned inventories:", error.message);
            throw new Error("Server error");
        }
    }

    async getAssignedInventories() {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const assignedInventories = await AssignedInventory.find({}, 'assignedInventoryId assignedDate receivedDate status totalAmountOfAssigned storeId')
                .sort({ assignedDate: -1 })
                .session(session) // Ensure the query uses the session
                .exec();

            if (assignedInventories.length === 0) {
                console.log('No assigned inventories found for the given storeId.');
                return []
            }

            // Step 2: Get unique storeIds from assignedInventories
            const storeIds = [...new Set(assignedInventories.map(assignedInventory => assignedInventory.storeId))];
            // Step 3: Fetch store names for the retrieved storeIds
            const stores = await Store.find({ storeId: { $in: storeIds } }, { storeId: 1, storeName: 1 }).session(session);// Ensure the query uses the session

            // Step 4: Create a storeId-to-storeName map for quick lookup
            const storeMap = stores.reduce((map, store) => {
                map[store.storeId] = store.storeName;
                return map;
            }, {});

            const formattedData = assignedInventories.map(inv => ({
                assignedInventoryId: inv.assignedInventoryId,
                assignedDate: inv.assignedDate,
                receivedDate: inv.receivedDate,
                status: inv.status,
                totalAmountOfAssigned: inv.totalAmountOfAssigned,
                storeId: inv.storeId,
                storeName: storeMap[inv.storeId] || 'Unknown Store' // Default to 'Unknown Store' if not found
            }));

            await session.commitTransaction();
            session.endSession();

            return formattedData
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.error("Error while retrieving assigned inventories:", error.message);
            throw new Error("Server error");
        }
    }

    async getAssignedInventoryDetails(assignedInventoryId) {
        try {
            const assignedInventory = await AssignedInventory.findOne({ assignedInventoryId })
                .populate({
                    path: 'products',
                    populate: {
                        path: 'variants'
                    }
                })
                .exec();

            if (!assignedInventory) {
                return res.status(404).json({
                    status: 404,
                    message: "Assigned inventory not found."
                });
            }

            const productsData = assignedInventory.products.map(product => ({
                productId: product.productId,
                group: product.group,
                category: product.category,
                subCategory: product.subCategory,
                gender: product.gender,
                productType: product.productType,
                fit: product.fit,
                neckline: product.neckline,
                pattern: product.pattern,
                sleeves: product.sleeves,
                material: product.material,
                price: product.price,
                productDescription: product.productDescription,
                sizeChart: product.sizeChart,
                variants: product.variants.map(variant => ({
                    color: variant.color.name,
                    variantSizes: variant.variantSizes.map(v => ({
                        size: v.size,
                        quantity: v.quantity,
                        styleCoat: v.styleCoat,
                        sku: v.sku
                    })),
                    imageUrls: variant.imageUrls,
                    variantId: variant.variantId
                }))
            }));

            // Get the store using storeId
            const storeDetails = await Store.findOne({ storeId: assignedInventory.storeId });

            if (!storeDetails) {
                throw new Error("Store not found.");
            }
            const storeData = {
                storeName: storeDetails.storeName,
                storeId: storeDetails.storeId,
                storeAddress: storeDetails.storeAddress,
                city: storeDetails.city,
                pincode: storeDetails.pincode,
                state: storeDetails.state,
                userName: storeDetails.userName,
                phoneNo: storeDetails.phoneNo,
                emailID: storeDetails.emailID,
                password: storeDetails.password
            }

            const responseData = {
                storeDetails: storeData,
                assignedInventoryId: assignedInventory.assignedInventoryId,
                storeId: assignedInventory.storeId,
                assignedDate: assignedInventory.assignedDate,
                receivedDate: assignedInventory.receivedDate,
                totalAmountOfAssigned: assignedInventory.totalAmountOfAssigned,
                Status: assignedInventory.status,
                products: productsData
            };

            return responseData
        } catch (error) {
            console.error("Error while retrieving assigned inventory details:", error.message);
            throw new Error("Server error.");;
        }
    }

    async downloadInventory(storeId, res) {
        try {
            const store = await Store.findOne({ storeId }).lean();

            if (!store || !store.products || store.products.length === 0) {
                return res.status(404).send({ message: "No products found for the specified storeId" });
            }

            // Define headers for the CSV file
            const csvStringifier = csvWriter({
                header: [
                    { id: 'productId', title: 'productId' },
                    { id: 'groupName', title: 'groupName' },
                    { id: 'categoryName', title: 'categoryName' },
                    { id: 'subCategoryName', title: 'subCategoryName' },
                    { id: 'gender', title: 'gender' },
                    { id: 'productType', title: 'productType' },
                    { id: 'fit', title: 'fit' },
                    { id: 'neckline', title: 'neckline' },
                    { id: 'pattern', title: 'pattern' },
                    { id: 'sleeves', title: 'sleeves' },
                    { id: 'material', title: 'material' },
                    { id: 'price', title: 'price' },
                    { id: 'productDescription', title: 'productDescription' },
                    { id: 'sizeChart', title: 'sizeChart' },
                    { id: 'variantId', title: 'variantId' },
                    { id: 'variantColor', title: 'variantColor' },
                    { id: 'hexcode', title: 'hexcode' },
                    { id: 'variantSize', title: 'variantSize' },
                    { id: 'variantImages', title: 'variantImages' },
                    { id: 'styleCoat', title: 'styleCoat' },
                    { id: 'sku', title: 'sku' },
                    { id: 'variantQuantity', title: 'variantQuantity' },
                ]
            });

            let records = [];

            store.products.forEach(product => {
                product.variants.forEach(variant => {
                    variant.variantSizes.forEach(v => {
                        const row = {
                            productId: product.productId,
                            groupName: product.group,
                            categoryName: product.category,
                            subCategoryName: product.subCategory,
                            gender: product.gender,
                            productType: product.productType,
                            fit: product.fit || "N/A",
                            neckline: product.neckline || "N/A",
                            pattern: product.pattern || "N/A",
                            sleeves: product.sleeves || "N/A",
                            material: product.material || "N/A",
                            price: product.price,
                            productDescription: product.productDescription || "N/A",
                            sizeChart: product.sizeChart || "N/A",
                            variantId: variant.variantId,
                            variantColor: variant.color.name,
                            hexcode: variant.color.hexcode,
                            variantSize: v.size,
                            variantImages: variant.imageUrls ? variant.imageUrls.join(', ') : "N/A",
                            styleCoat: v.styleCoat,
                            sku: v.sku,
                            variantQuantity: v.quantity,
                        };
                        records.push(row);
                    });
                });
            });

            if (records.length === 0) {
                return res.status(404).send({ message: "No variant data available for the specified school name" });
            }

            // Generate CSV content
            const header = csvStringifier.getHeaderString();
            const csvContent = csvStringifier.stringifyRecords(records);

            // Prepare the CSV output
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="inventory_${storeId}.csv"`);
            // Send the CSV content
            res.send(header + csvContent);

        } catch (error) {
            console.error("Error generating CSV file:", error.message);
            throw new Error("Server error");
        }
    }

    async getRaisedInventoryRequestsByStore(storeId) {
        try {
            const raisedInventories = await RaisedInventory.find({ storeId }, 'raisedInventoryId raisedDate approvedDate rejectedDate receivedDate status totalAmountOfAssigned').sort({ raisedDate: -1 })
                .exec();

            if (raisedInventories.length === 0) {
                return res.status(404).json({
                    status: 404,
                    message: 'No assigned inventories found for the given storeId.'
                });
            }

            const formattedData = raisedInventories.map(inv => ({
                raisedInventoryId: inv.raisedInventoryId,
                raisedDate: inv.raisedDate,
                approvedDate: inv.approvedDate,
                rejectedDate: inv.rejectedDate,
                receivedDate: inv.receivedDate,
                status: inv.status
            }));

            return formattedData
        } catch (error) {
            console.error("Error while retrieving raised inventories requests:", error.message);
            throw new Error("Server error");
        }
    }

    async getRaisedInventoryRequests() {
        try {
            const raisedInventories = await RaisedInventory.find({}, 'raisedInventoryId raisedDate approvedDate rejectedDate receivedDate status totalAmountOfAssigned')
                .sort({ raisedDate: -1 }).exec();

            if (raisedInventories.length === 0) {
                return []
            }

            const formattedData = raisedInventories.map(inv => ({
                raisedInventoryId: inv.raisedInventoryId,
                raisedDate: inv.raisedDate,
                approvedDate: inv.approvedDate,
                rejectedDate: inv.rejectedDate,
                receivedDate: inv.receivedDate,
                status: inv.status
            }));

            return formattedData
        } catch (error) {
            console.error("Error while retrieving assigned inventories:", error.message);
            throw new Error("Server error");
        }
    }

    async getRaisedInventoryDetails(raisedInventoryId, roleType) {
        try {
            const raisedInventory = await RaisedInventory.findOne({ raisedInventoryId })
                .populate({
                    path: 'products',
                    populate: {
                        path: 'variants'
                    }
                })
                .exec();

            if (!raisedInventory) {
                throw new Error('Assigned inventory not found');
            }

            const productsData = await Promise.all(raisedInventory.products.map(async product => {
                const togsProduct = roleType === 'WAREHOUSE MANAGER' ? await Togs.findOne({ productId: product.productId }).exec() : null;
                const togsVariantsMap = togsProduct ? togsProduct.variants.reduce((map, variant) => {
                    map[variant.variantId] = variant; // Assuming `variantId` is the linking key
                    return map;
                }, {}) : {};

                return {
                    productId: product.productId,
                    group: product.group,
                    category: product.category,
                    subCategory: product.subCategory,
                    gender: product.gender,
                    productType: product.productType,
                    fit: product.fit,
                    neckline: product.neckline,
                    pattern: product.pattern,
                    sleeves: product.sleeves,
                    material: product.material,
                    price: product.price,
                    productDescription: product.productDescription,
                    sizeChart: product.sizeChart,
                    variants: product.variants.map(variant => {
                        const togsVariant = togsVariantsMap[variant.variantId]; // Get matching Togs variant
                        return {
                            color: variant.color.name,
                            variantSizes: variant.variantSizes.map(v => {
                                const quantityInWarehouse = togsVariant && roleType === 'WAREHOUSE MANAGER' ? togsVariant.variantSizes.find(tv => tv.size === v.size)?.quantity : 0;
                                return {
                                    size: v.size,
                                    quantity: v.quantity,
                                    quantityInWarehouse: roleType === 'WAREHOUSE MANAGER' ? quantityInWarehouse : undefined,
                                    styleCoat: v.styleCoat,
                                    sku: v.sku,
                                    isApproved: v.isApproved,
                                    isReceived: v.isReceived
                                };
                            }),
                            imageUrls: variant.imageUrls,
                            variantId: variant.variantId
                        };
                    })
                };
            }));

            const responseData = {
                raisedInventoryId: raisedInventory.raisedInventoryId,
                storeId: raisedInventory.storeId,
                storeName: raisedInventory.storeName,
                raisedDate: raisedInventory.raisedDate,
                approvedDate: raisedInventory.approvedDate,
                rejectedDate: raisedInventory.rejectedDate,
                receivedDate: raisedInventory.receivedDate,
                totalAmountRaised: raisedInventory.totalAmountRaised,
                Status: raisedInventory.status,
                products: productsData
            };

            return responseData;
        } catch (error) {
            console.error("Error while retrieving raised inventory details:", error.message);
            throw new Error("Server error.");
        }
    }

    async approveInventory(raisedInventoryId, roleType) {
        try {
            // Fetch the raised inventory details
            const raisedInventory = await RaisedInventory.findOne({ raisedInventoryId }).populate({
                path: 'products',
                populate: {
                    path: 'variants'
                }
            }).exec();

            if (!raisedInventory) {
                return res.status(404).json({
                    status: 404,
                    message: "Raised Inventory request not found."
                });
            }

            // Track whether all variants are approved
            let allVariantsApproved = true;

            // Prepare updates for Togs and process each product's variants
            const updates = [];
            for (const product of raisedInventory.products) {
                const togsProduct = await Togs.findOne({ productId: product.productId }).exec();
                if (!togsProduct) continue;

                for (const variant of product.variants) {
                    let allSizesApproved = true;

                    for (const vSize of variant.variantSizes) {
                        // If the size is already approved, skip to the next one
                        if (vSize.isApproved) continue;

                        const togsVariant = togsProduct.variants.find(tv => tv.variantId === variant.variantId);
                        if (!togsVariant) {
                            allSizesApproved = false;
                            continue;
                        }

                        const togsSize = togsVariant.variantSizes.find(tv => tv.size === vSize.size);
                        if (!togsSize || togsSize.quantity < vSize.quantity) {
                            allSizesApproved = false;
                            allVariantsApproved = false;
                            continue;
                        }

                        // Approve the size if quantity is available and deduct the stock
                        togsSize.quantity -= vSize.quantity;
                        vSize.isApproved = true;

                        updates.push({ togsProduct, togsVariant, togsSize });
                    }

                    if (!allSizesApproved) {
                        allVariantsApproved = false;
                    }
                }
            }

            // Apply stock deductions to the Togs warehouse
            for (let update of updates) {
                await update.togsProduct.save();
            }

            // Set the status based on approval status
            if (allVariantsApproved) {
                raisedInventory.status = 'APPROVED';
                raisedInventory.approvedDate = new Date().toISOString(); // Set approved date
            } else {
                raisedInventory.status = 'DRAFT';
            }

            // Save the updated raised inventory
            await raisedInventory.save();

            // Return response based on final status
            if (raisedInventory.status === 'APPROVED') {
                return {
                    message: "Inventory successfully approved and quantities updated in warehouse."

                }
            } else {
                return {
                    message: "Partial approval complete. Inventory status set to DRAFT, awaiting full approval."
                }
            }
        } catch (error) {
            console.error("Error while approving inventory:", error.message);
            throw new Error(error.message);
        }
    }

    async rejectInventory(raisedInventoryId, roleType) {
        try {
            // Fetch the raised inventory details
            const raisedInventory = await RaisedInventory.findOne({ raisedInventoryId }).populate({
                path: 'products',
                populate: {
                    path: 'variants'
                }
            }).exec();

            if (!raisedInventory) {
                return res.status(404).json({
                    status: 404,
                    message: "Raised Inventory request not found."
                });
            }

            raisedInventory.status = 'REJECTED';
            raisedInventory.rejectedDate = new Date().toISOString(); // Set approved date


            // Save the updated raised inventory
            await raisedInventory.save();

            return {
                message: "Inventory request rejected successfully."
            }

        } catch (error) {
            console.error("Error while rejecting inventory request:", error.message);
            throw new Error(error.message);
        }
    }

    async receiveInventoryReq(raisedInventoryId, roleType, userStoreId) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            // Fetch the raised inventory
            const raisedInventory = await RaisedInventory.findOne({ raisedInventoryId }).session(session);

            if (!raisedInventory) {
                throw new Error("Raised Inventory not found.");
            }

            // If the user is a STORE MANAGER, ensure they are associated with the correct store
            if (roleType === 'STORE MANAGER' && raisedInventory.storeId !== userStoreId) {
                throw new Error("Forbidden. You are not authorized to receive this inventory.");
            }

            // Check if the inventory has already been fully received
            if (raisedInventory.status === 'RECEIVED' && raisedInventory.products.every(product =>
                product.variants.every(variant => variant.variantSizes.every(size => size.isReceived))
            )) {
                throw new Error("Inventory has already been fully received.");
            }

            // Get the store associated with the raised inventory
            const store = await Store.findOne({ storeId: raisedInventory.storeId }).session(session);

            if (!store) {
                throw new Error("Store not found.");
            }

            // Flag to track whether all variants are received
            let allVariantsReceived = true;

            // Update store's products with only the approved and unreceived variants and sizes
            for (let raisedProduct of raisedInventory.products) {
                let storeProduct = store.products.find(p => p.productId === raisedProduct.productId);

                if (!storeProduct) {
                    // Add the product only if it contains unreceived approved variants
                    const unreceivedApprovedVariants = raisedProduct.variants.filter(variant =>
                        variant.variantSizes.some(size => size.isApproved && !size.isReceived)
                    );

                    if (unreceivedApprovedVariants.length > 0) {
                        // Clone the product with only unreceived approved variants
                        storeProduct = { ...raisedProduct, variants: unreceivedApprovedVariants };
                        store.products.push(storeProduct);
                    }
                } else {
                    for (let raisedVariant of raisedProduct.variants) {
                        let storeVariant = storeProduct.variants.find(v => v.color.name === raisedVariant.color.name);

                        if (!storeVariant) {
                            // Add the variant only if it contains unreceived approved sizes
                            const unreceivedApprovedSizes = raisedVariant.variantSizes.filter(size =>
                                size.isApproved && !size.isReceived
                            );

                            if (unreceivedApprovedSizes.length > 0) {
                                // Clone the variant with only unreceived approved sizes
                                storeVariant = { ...raisedVariant, variantSizes: unreceivedApprovedSizes };
                                storeProduct.variants.push(storeVariant);
                            }
                        } else {
                            // Update the variant with only unreceived approved sizes
                            for (let raisedSize of raisedVariant.variantSizes) {
                                if (raisedSize.isApproved && !raisedSize.isReceived) {
                                    let storeSize = storeVariant.variantSizes.find(s => s.size === raisedSize.size);

                                    if (!storeSize) {
                                        // Add the size if it doesn't exist in the store
                                        storeVariant.variantSizes.push({ ...raisedSize });
                                    } else {
                                        // Update the quantity if the size already exists
                                        storeSize.quantity += raisedSize.quantity;
                                    }

                                    // Mark the size as received
                                    raisedSize.isReceived = true;
                                } else if (!raisedSize.isReceived) {
                                    allVariantsReceived = false;
                                }
                            }
                        }
                    }
                }
            }

            // Set the status to RECEIVED if all variants are approved and received, otherwise set to DRAFT
            if (allVariantsReceived) {
                raisedInventory.status = 'RECEIVED';
                raisedInventory.receivedDate = new Date();
            } else {
                raisedInventory.status = 'DRAFT';
            }

            // Save the updated raised inventory and store
            await raisedInventory.save({ session });
            await store.save({ session });

            // Commit the transaction
            await session.commitTransaction();
            session.endSession();

            return {
                status: 200,
                message: allVariantsReceived
                    ? "Inventory fully received and store updated successfully."
                    : "Partial inventory received. Store updated, awaiting remaining approval."
            };
        } catch (err) {
            // Rollback the transaction in case of any error
            await session.abortTransaction();
            session.endSession();
            console.error("Error while receiving inventory:", err.message);
            throw err;
        }
    }


    async getproducts(storeId) {
        try {
            const store = await Store.findOne({ storeId })
                .populate({
                    path: 'products',
                    populate: {
                        path: 'variants'
                    }
                })
                .exec();

            if (!store) {
                throw new Error('Store not found');
            }

            const productsData = store.products.map(product => ({
                productId: product.productId,
                group: product.group,
                category: product.category,
                subCategory: product.subCategory,
                subCategory: product.subCategory,
                gender: product.gender,
                productType: product.productType,
                fit: product.fit,
                neckline: product.neckline,
                pattern: product.pattern,
                sleeves: product.sleeves,
                material: product.material,
                price: product.price,
                productDescription: product.productDescription,
                sizeChart: product.sizeChart,
                variants: product.variants.map(variant => ({
                    color: variant.color.name,
                    variantSizes: variant.variantSizes.map(v => ({
                        size: v.size,
                        quantity: v.quantity,
                        styleCoat: v.styleCoat,
                        sku: v.sku
                    })),
                    imageUrls: variant.imageUrls,
                    variantId: variant.variantId
                }))
            }));

            return productsData
        } catch (error) {
            console.error("Error while retrieving products:", error.message);
            throw new Error("Server error.");
        }
    }

    async createBill(storeId, billData) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { customerDetails, products, discountPercentage, modeOfPayment } = billData;

            // 1. Find the store using storeId
            const store = await Store.findOne({ storeId }).session(session);
            if (!store) {
                throw new Error('Store not found');
            }

            // 2. Find the customer by phone number or create a new one if not found
            let customer = await Customer.findOne({ customerPhone: customerDetails.customerPhone }).session(session);

            if (!customer) {
                // Create new customer if not found
                customer = new Customer({
                    customerName: customerDetails.customerName,
                    customerPhone: customerDetails.customerPhone,
                    customerEmail: customerDetails.customerEmail,
                    isCreated: true
                });
                await customer.save({ session });
            } else {
                // If customer is found, check if customerPhone or customerEmail are different
                let isUpdated = false;

                if (customer.customerPhone !== customerDetails.customerPhone) {
                    customer.customerPhone = customerDetails.customerPhone;
                    isUpdated = true;
                }

                if (customer.customerEmail !== customerDetails.customerEmail) {
                    customer.customerEmail = customerDetails.customerEmail;
                    isUpdated = true;
                }

                // Only save if there are changes
                if (isUpdated) {
                    await customer.save({ session });
                }
            }

            // 3. Validate product quantities and fetch product details to structure them for the bill
            const billedProducts = [];
            let totalAmount = 0;

            for (let billProduct of products) {
                const { productId, variantId, styleCoat, billingQuantity } = billProduct;

                // Find the product in the store
                const storeProduct = store.products.find(p => p.productId === productId);
                if (!storeProduct) {
                    throw new Error(`Product with ID ${productId} not found in store`);
                }

                // Find the variant in the product
                const storeVariant = storeProduct.variants.find(v => v.variantId === variantId);
                if (!storeVariant) {
                    throw new Error(`Variant with ID ${variantId} not found in product ${productId}`);
                }

                // Find the size/coat in the variant
                const storeSize = storeVariant.variantSizes.find(s => s.styleCoat === styleCoat);
                if (!storeSize) {
                    throw new Error(`Style coat ${styleCoat} not found in variant ${variantId}`);
                }

                // Check if the quantity is sufficient
                if (storeSize.quantity < billingQuantity) {
                    throw new Error(`Insufficient quantity for style coat ${styleCoat}, available: ${storeSize.quantity}, required: ${billingQuantity}`);
                }

                // Reduce the store quantity for this variant size
                storeSize.quantity -= billingQuantity;

                // Calculate the total billed amount for this product (price * quantity)
                const billedPrice = storeProduct.price * billingQuantity;
                totalAmount += billedPrice;

                // Check if the product already exists in the billedProducts array
                let billedProduct = billedProducts.find(p => p.productId === productId);
                if (!billedProduct) {
                    // If the product does not exist, create it and add it to billedProducts
                    billedProduct = {
                        productId: storeProduct.productId,
                        group: storeProduct.group,
                        category: storeProduct.category,
                        subCategory: storeProduct.subCategory,
                        gender: storeProduct.gender,
                        productType: storeProduct.productType,
                        fit: storeProduct.fit,
                        neckline: storeProduct.neckline,
                        pattern: storeProduct.pattern,
                        sleeves: storeProduct.sleeves,
                        material: storeProduct.material,
                        price: storeProduct.price,
                        productDescription: storeProduct.productDescription,
                        sizeChart: storeProduct.sizeChart,
                        variants: [] // Initialize an empty array for variants
                    };
                    billedProducts.push(billedProduct);
                }

                // Check if the variant already exists in the product's variants array
                let billedVariant = billedProduct.variants.find(v => v.variantId === variantId);
                if (!billedVariant) {
                    // If the variant does not exist, create it and add it to the product's variants array
                    billedVariant = {
                        variantId: storeVariant.variantId,
                        color: storeVariant.color,
                        variantSizes: [], // Initialize an empty array for variantSizes
                        imageUrls: storeVariant.imageUrls,
                        isDeleted: storeVariant.isDeleted
                    };
                    billedProduct.variants.push(billedVariant);
                }

                // Check if the styleCoat already exists in the variantSizes array
                let billedSize = billedVariant.variantSizes.find(s => s.styleCoat === styleCoat);
                if (billedSize) {
                    // If the styleCoat exists, just add the billingQuantity to the existing billedQuantity
                    billedSize.billedQuantity += billingQuantity;
                } else {
                    // If the styleCoat does not exist, add it to the variantSizes array
                    billedVariant.variantSizes.push({
                        size: storeSize.size,
                        billedQuantity: billingQuantity, // The quantity being billed
                        styleCoat: storeSize.styleCoat,
                        sku: storeSize.sku
                    });
                }
            }

            // 4. Calculate the total price and apply discount
            const discount = discountPercentage ? (totalAmount * (discountPercentage / 100)) : 0;
            const priceAfterDiscount = totalAmount - discount;

            const counter = await Counter.findByIdAndUpdate(
                { _id: 'billId' }, // We use 'billId' as the identifier for this sequence
                { $inc: { seq: 1 } }, // Increment the sequence by 1
                { new: true, upsert: true } // Return the updated document, create if it doesn't exist
            );

            const invoiceNo = `INVOICE-${counter.seq}`;

            // 5. Create the bill with customer reference
            const bill = new Bill({
                invoiceNo,
                storeId,
                customer: customer._id, // Linking the customer
                TotalAmount: totalAmount,
                discountPercentage: discountPercentage || 0, // Using the discount from request
                priceAfterDiscount,
                modeOfPayment: modeOfPayment,
                products: billedProducts // Saving the products with variants in the bill
            });

            await bill.save({ session });

            // 6. Update the store's products with the new quantities
            await store.save({ session });

            // Commit the transaction
            await session.commitTransaction();
            session.endSession();

            return {
                status: 200,
                message: "Bill created successfully",
                billId: bill.billId,
                invoiceNo: bill.invoiceNo,
                dateOfBill: bill.dateOfBill,
                customerDetails,
                modeOfPayment,
                billedProducts,
                totalAmount,
                discountPercentage: discountPercentage || 0, // Using the discount from request
                priceAfterDiscount
            };
        } catch (error) {
            // Rollback transaction in case of any failure
            await session.abortTransaction();
            session.endSession();
            console.error("Error creating bill:", error.message);
            throw new Error(error.message);
        }
    }

    async createBillDeleteReq(storeId, billId, RequestedBillDeleteNote) {
        try {
            // Find the bill by storeId and billId first
            const bill = await Bill.findOne({ storeId, billId });

            if (!bill) {
                return {
                    status: 404,
                    message: 'Bill not found for the provided storeId and billId'
                };
            }

            // If not already deleted, update the isDeleted field to true and set deletedDate
            bill.deleteReqStatus = 'PENDING';
            bill.dateOfDeleteBillReq = new Date();
            bill.RequestedBillDeleteNote = RequestedBillDeleteNote;
            await bill.save();

            return {
                status: 200,
                message: 'Bill delete request raised successfully',
                // bill
            };
        } catch (error) {
            console.error('Error while raising bill delete req:', error.message);
            throw new Error(error.message);
        }
    }

    async validateBillDeleteReq(storeId, billId, isApproved, ValidatedBillDeleteNote) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {

            const bill = await Bill.findOne({ storeId, billId })
                .session(session);

            if (!bill) {
                throw new Error('Bill not found for the provided storeId and billId')
            }

            if (isApproved == "false") {
                bill.deleteReqStatus = 'REJECTED';
                bill.dateOfDeleteBillReqValidation = new Date();
                bill.ValidatedBillDeleteNote = ValidatedBillDeleteNote;
                await bill.save();

                await session.commitTransaction();
                session.endSession();

                return {
                    message: 'Bill delete Request REJECTED successfully.'
                }
            }

            bill.deleteReqStatus = 'APPROVED';
            bill.dateOfDeleteBillReqValidation = new Date();
            bill.ValidatedBillDeleteNote = ValidatedBillDeleteNote;
            bill.isDeleted = true;

            await bill.save();

            await session.commitTransaction();
            session.endSession();

            return {
                message: 'Bill delete Request approved successfully.'
            }

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.error('Error validating bill delete request:', error.message);
            throw new Error(error.message);
        }
    }

    async getDeletedBillsByStoreId(storeId) {
        try {
            // Find all deleted bills for the given storeId and return only the required fields
            const deletedBills = await Bill.find(
                { storeId, deleteReqStatus: { $ne: null } }, // Query to find bills that are marked as deleted
                {
                    billId: 1,
                    dateOfBill: 1,
                    deleteReqStatus: 1,
                    dateOfDeleteBillReq: 1,
                    dateOfDeleteBillReqValidation: 1,
                    deletedDate: 1,
                    isDeleted: 1,
                    TotalAmount: 1,
                    discountPercentage: 1,
                    priceAfterDiscount: 1
                } // Projection to return only specific fields
            ).sort({ dateOfDeleteBillReq: -1 });

            if (!deletedBills.length) {
                return []
            }

            return deletedBills
        } catch (error) {
            console.error('Error fetching deleted bills:', error.message);
            throw new Error(error.message);
        }
    }

    async getDeletedBills() {
        try {
            // Step 1: Find all deleted bills
            const deletedBills = await Bill.find(
                { deleteReqStatus: { $ne: null } }, // Query to find bills that are marked as deleted
                {
                    billId: 1,
                    dateOfBill: 1,
                    deleteReqStatus: 1,
                    dateOfDeleteBillReq: 1,
                    dateOfDeleteBillReqValidation: 1,
                    deletedDate: 1,
                    isDeleted: 1,
                    TotalAmount: 1,
                    discountPercentage: 1,
                    priceAfterDiscount: 1,
                    storeId: 1 // Include storeId to use it later for fetching storeName
                }
            ).sort({ dateOfDeleteBillReq: -1 });

            if (!deletedBills.length) {
                return [];
            }

            // Step 2: Get unique storeIds from deletedBills
            const storeIds = [...new Set(deletedBills.map(bill => bill.storeId))];

            // Step 3: Fetch store names for the retrieved storeIds
            const stores = await Store.find({ storeId: { $in: storeIds } }, { storeId: 1, storeName: 1 });

            // Step 4: Create a storeId-to-storeName map for quick lookup
            const storeMap = stores.reduce((map, store) => {
                map[store.storeId] = store.storeName;
                return map;
            }, {});

            // Step 5: Map through the deletedBills and append the storeName
            const result = deletedBills.map(bill => ({
                billId: bill.billId,
                dateOfBill: bill.dateOfBill,
                deleteReqStatus: bill.deleteReqStatus,
                dateOfDeleteBillReq: bill.dateOfDeleteBillReq,
                isDeleted: bill.isDeleted,
                TotalAmount: bill.TotalAmount,
                discountPercentage: bill.discountPercentage,
                priceAfterDiscount: bill.priceAfterDiscount,
                storeId: bill.storeId,
                storeName: storeMap[bill.storeId] || 'Unknown Store' // Default to 'Unknown Store' if not found
            }));

            return result;
        } catch (error) {
            console.error('Error fetching deleted bills:', error.message);
            throw new Error(error.message);
        }
    }

    async getBills() {
        try {
            const Bills = await Bill.find(
                { isDeleted: false }, // Query to find bills that are marked as deleted
                {
                    billId: 1,
                    dateOfBill: 1,
                    deletedDate: 1,
                    TotalAmount: 1,
                    discountPercentage: 1,
                    priceAfterDiscount: 1,
                    editStatus: 1,
                    storeId: 1
                } // Projection to return only specific fields
            ).sort({ dateOfBill: -1 });;

            if (!Bills.length) {
                return [];
            }

            // Step 2: Get unique storeIds from Bills
            const storeIds = [...new Set(Bills.map(bill => bill.storeId))];

            // Step 3: Fetch store names for the retrieved storeIds
            const stores = await Store.find({ storeId: { $in: storeIds } }, { storeId: 1, storeName: 1 });

            // Step 4: Create a storeId-to-storeName map for quick lookup
            const storeMap = stores.reduce((map, store) => {
                map[store.storeId] = store.storeName;
                return map;
            }, {});

            // Step 5: Map through the deletedBills and append the storeName
            const result = Bills.map(bill => ({
                billId: bill.billId,
                dateOfBill: bill.dateOfBill,
                deletedDate: bill.deletedDate,
                TotalAmount: bill.TotalAmount,
                discountPercentage: bill.discountPercentage,
                priceAfterDiscount: bill.priceAfterDiscount,
                editStatus: bill.editStatus,
                storeId: bill.storeId,
                storeName: storeMap[bill.storeId] || 'Unknown Store' // Default to 'Unknown Store' if not found
            }));

            return result;
        } catch (error) {
            console.error('Error fetching deleted bills:', error.message);
            throw new Error(error.message);
        }
    }

    async getBillsByStoreId(storeId) {
        try {
            // Find all bills for the given storeId and return only the required fields
            const Bills = await Bill.find(
                { storeId, isDeleted: false }, // Query to find bills that are marked as deleted
                {
                    billId: 1,
                    dateOfBill: 1,
                    deletedDate: 1,
                    TotalAmount: 1,
                    discountPercentage: 1,
                    priceAfterDiscount: 1,
                    editStatus: 1
                } // Projection to return only specific fields
            ).sort({ dateOfBill: -1 });

            if (!Bills.length) {
                return []
            }

            return Bills
        } catch (error) {
            console.error('Error fetching deleted bills:', error.message);
            throw new Error(error.message);
        }
    }

    async getBillDetailsByBillId(billId) {
        try {
            // Fetch the bill by billId
            const bill = await Bill.findOne({ billId })
                .populate('customer', 'customerName customerPhone customerEmail')
                .lean();

            if (!bill) {
                throw new Error('Bill not found for the provided billId')
            }

            // Loop through the products and variants to fetch the real-time quantityInStore from the Store schema
            for (const product of bill.products) {
                for (const variant of product.variants) {
                    for (const variantSize of variant.variantSizes) {
                        const store = await Store.findOne({
                            'products.productId': product.productId,
                            'products.variants.variantId': variant.variantId,
                            'products.variants.variantSizes.size': variantSize.size
                        }, {
                            'products': 1 // Fetch all products matching the condition
                        });

                        if (store && store.products.length) {
                            // Find the correct product in the array of products
                            const storeProduct = store.products.find(p => p.productId === product.productId);

                            if (storeProduct) {
                                // Find the correct variant in the product
                                const matchedVariant = storeProduct.variants.find(v => v.variantId === variant.variantId);

                                if (matchedVariant) {
                                    // Find the correct variant size in the variant
                                    const matchedSize = matchedVariant.variantSizes.find(vs => vs.size === variantSize.size);

                                    if (matchedSize) {
                                        variantSize.quantityInStore = matchedSize.quantity; // Add real-time quantityInStore
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Return the entire bill including products, variants, and variantSizes
            return bill

        } catch (error) {
            console.error('Error fetching bill details:', error.message);
            throw new Error(error.message);
        }
    }

    async getCustomerByPhone(customerPhone) {
        try {
            const customer = await Customer.findOne({ customerPhone: customerPhone, isCreated: true });
            if (!customer) {
                return {};
            }
            return {
                customerName: customer.customerName,
                customerPhone: customer.customerPhone,
                customerEmail: customer.customerEmail
            };
        } catch (error) {
            console.error('Error fetching customer details:', error);
            throw new Error(error.message);
        }
    };

    async createCustomer(customerDetails) {
        try {
            // Check if the customer exists by phone number
            let customer = await Customer.findOne({ customerPhone: customerDetails.customerPhone });

            // If the customer does not exist, create a new customer
            if (!customer) {
                customer = new Customer({
                    customerName: customerDetails.customerName,
                    customerPhone: customerDetails.customerPhone,
                    customerEmail: customerDetails.customerEmail
                });
                await customer.save(); // Save the new customer to the database
            }

            // Return the customer details
            return {
                customerName: customer.customerName,
                customerPhone: customer.customerPhone,
                customerEmail: customer.customerEmail
            };
        } catch (error) {
            console.error('Error creating or fetching customer details:', error);
            throw new Error(error.message); // Handle any errors that occur
        }
    }

    async createBillEditReq(billId, storeId, billEditReqData) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { customerDetails, products, discountPercentage, reqNote } = billEditReqData;

            // Create a new customer if not found
            const customer = new Customer({
                customerName: customerDetails.customerName,
                customerPhone: customerDetails.customerPhone,
                customerEmail: customerDetails.customerEmail,
            });
            await customer.save({ session });

            // 1. Find the original bill using the provided billId
            const originalBill = await Bill.findOne({ billId }).populate('customer').session(session);
            if (!originalBill) {
                throw new Error('Bill not found');
            }

            // 2. Find the store by storeId
            const store = await Store.findOne({ storeId }).session(session);
            if (!store) {
                throw new Error('Store not found');
            }

            let totalAmount = 0;
            const editedProducts = [];

            // 3. Loop through each product in the req.body.products
            for (let reqProduct of products) {
                const { productId, variantId, styleCoat, billingQuantity } = reqProduct;

                // Find the original product, variant, and variantSize
                let originalProduct = originalBill.products.find(p => p.productId === productId);
                let originalVariant, originalVariantSize;
                if (originalProduct) {
                    originalVariant = originalProduct.variants.find(v => v.variantId === variantId);
                    if (originalVariant) {
                        originalVariantSize = originalVariant.variantSizes.find(vs => vs.styleCoat === styleCoat);
                    }
                }

                // If the product/variant/variantSize doesn't exist in the original bill, just add it
                if (!originalProduct || !originalVariant || !originalVariantSize) {
                    const storeProduct = store.products.find(p => p.productId === productId);
                    if (!storeProduct) {
                        throw new Error(`Product with ID ${productId} not found in the store`);
                    }

                    const storeVariant = storeProduct.variants.find(v => v.variantId === variantId);
                    if (!storeVariant) {
                        throw new Error(`Variant with ID ${variantId} not found in store product ${productId}`);
                    }

                    const storeVariantSize = storeVariant.variantSizes.find(s => s.styleCoat === styleCoat);
                    if (!storeVariantSize) {
                        throw new Error(`StyleCoat ${styleCoat} not found in store variant ${variantId}`);
                    }

                    // Check if enough quantity is available in the store
                    if (storeVariantSize.quantity < billingQuantity) {
                        throw new Error(`Insufficient quantity for style coat ${styleCoat}, required: ${billingQuantity}, available: ${storeVariantSize.quantity}`);
                    }

                    // Add this new product to the editedProducts array
                    let newProduct = editedProducts.find(p => p.productId === productId);
                    if (!newProduct) {
                        newProduct = {
                            productId: storeProduct.productId,
                            group: storeProduct.group,
                            category: storeProduct.category,
                            subCategory: storeProduct.subCategory,
                            gender: storeProduct.gender,
                            productType: storeProduct.productType,
                            fit: storeProduct.fit,
                            neckline: storeProduct.neckline,
                            pattern: storeProduct.pattern,
                            sleeves: storeProduct.sleeves,
                            material: storeProduct.material,
                            price: storeProduct.price,
                            productDescription: storeProduct.productDescription,
                            sizeChart: storeProduct.sizeChart,
                            variants: []
                        };
                        editedProducts.push(newProduct);
                    }

                    let newVariant = newProduct.variants.find(v => v.variantId === variantId);
                    if (!newVariant) {
                        newVariant = {
                            variantId: storeVariant.variantId,
                            color: storeVariant.color,
                            variantSizes: [],
                            imageUrls: storeVariant.imageUrls,
                            isDeleted: storeVariant.isDeleted
                        };
                        newProduct.variants.push(newVariant);
                    }

                    // Add the variant size with the requested billing quantity
                    newVariant.variantSizes.push({
                        size: storeVariantSize.size,
                        billedQuantity: billingQuantity,
                        styleCoat: storeVariantSize.styleCoat,
                        sku: storeVariantSize.sku
                    });

                    // Decrease the store quantity for this variantSize
                    storeVariantSize.quantity -= billingQuantity;

                    totalAmount += storeProduct.price * billingQuantity;

                    continue;
                }

                // 4. Handle existing product/variant/variantSize
                const existingBilledQuantity = originalVariantSize.billedQuantity;
                const extraBillingQuantity = billingQuantity - existingBilledQuantity;

                const storeProduct = store.products.find(p => p.productId === productId);
                const storeVariant = storeProduct.variants.find(v => v.variantId === variantId);
                const storeVariantSize = storeVariant.variantSizes.find(s => s.styleCoat === styleCoat);

                // Check if enough quantity is available in the store
                if (storeVariantSize.quantity < extraBillingQuantity) {
                    throw new Error(`Insufficient quantity for style coat ${styleCoat}, required: ${extraBillingQuantity}, available: ${storeVariantSize.quantity}`);
                }

                // Add or update the product details
                let editedProduct = editedProducts.find(p => p.productId === productId);
                if (!editedProduct) {
                    editedProduct = {
                        productId: storeProduct.productId,
                        group: storeProduct.group,
                        category: storeProduct.category,
                        subCategory: storeProduct.subCategory,
                        gender: storeProduct.gender,
                        productType: storeProduct.productType,
                        fit: storeProduct.fit,
                        neckline: storeProduct.neckline,
                        pattern: storeProduct.pattern,
                        sleeves: storeProduct.sleeves,
                        material: storeProduct.material,
                        price: storeProduct.price,
                        productDescription: storeProduct.productDescription,
                        sizeChart: storeProduct.sizeChart,
                        variants: []
                    };
                    editedProducts.push(editedProduct);
                }

                let editedVariant = editedProduct.variants.find(v => v.variantId === variantId);
                if (!editedVariant) {
                    editedVariant = {
                        variantId: storeVariant.variantId,
                        color: storeVariant.color,
                        variantSizes: [],
                        imageUrls: storeVariant.imageUrls,
                        isDeleted: storeVariant.isDeleted
                    };
                    editedProduct.variants.push(editedVariant);
                }

                // Update the billing quantity
                editedVariant.variantSizes.push({
                    size: storeVariantSize.size,
                    billedQuantity: billingQuantity,
                    styleCoat: storeVariantSize.styleCoat,
                    sku: storeVariantSize.sku
                });

                storeVariantSize.quantity -= extraBillingQuantity;
                totalAmount += storeProduct.price * billingQuantity;
            }

            // 5. Calculate the discount and price after discount
            const discount = discountPercentage ? (totalAmount * (discountPercentage / 100)) : 0;
            const priceAfterDiscount = totalAmount - discount;

            // 6. Create the BillEditReq with a reference to the original bill
            const billEditReq = new BillEditReq({
                bill: originalBill._id,
                storeId,
                customer: customer._id,
                TotalAmount: totalAmount,
                discountPercentage: discountPercentage || 0,
                priceAfterDiscount,
                dateOfBill: originalBill.dateOfBill,
                reqNote,
                products: editedProducts
            });

            // Update the editStatus to 'PENDING'
            originalBill.editStatus = 'PENDING';
            await originalBill.save({ session });

            // Save the BillEditReq and update the store
            await billEditReq.save({ session });
            await store.save({ session });

            // Commit the transaction
            await session.commitTransaction();
            session.endSession();

            return {
                message: 'Bill edit request created successfully',
                editBillReqId: billEditReq.editBillReqId
            };
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.error('Error creating bill edit request:', error.message);
            throw new Error(error.message);
        }
    }

    async getBillEditReqsByStoreId(storeId) {
        try {
            // Find all deleted bills for the given storeId and return only the required fields
            const BillEditReqs = await BillEditReq.find(
                { storeId }, // Query to find bills that are marked as deleted
                {
                    editBillReqId: 1,
                    isApproved: 1,
                    dateOfValidate: 1,
                    dateOfBillEditReq: 1,
                    dateOfBill: 1,
                } // Projection to return only specific fields
            ).sort({ dateOfBillEditReq: -1 });

            if (!BillEditReqs.length) {
                return []
            }

            return BillEditReqs
        } catch (error) {
            console.error('Error fetching bill edit reqs:', error.message);
            throw new Error(error.message);
        }
    }

    async getBillEditReqs() {
        try {
            // Fetch all BillEditReqs without filter, just projection
            const BillEditReqs = await BillEditReq.find({}, {
                _id: 0, // Exclude _id from the result
                editBillReqId: 1, // Project to include only specific fields
                isApproved: 1,
                dateOfValidate: 1,
                dateOfBillEditReq: 1,
                dateOfBill: 1,
            }).sort({ dateOfBillEditReq: -1 });

            if (!BillEditReqs.length) {
                return []; // Return empty array if no BillEditReqs are found
            }

            return BillEditReqs; // Return all found BillEditReqs
        } catch (error) {
            console.error('Error fetching bill edit reqs:', error.message);
            throw new Error(error.message);
        }
    }


    async getBillEditReqDetails(editBillReqId) {
        try {
            // 1. Fetch the requested bill edit, and populate only the necessary fields
            const requestedBillEdit = await BillEditReq.findOne({ editBillReqId })
                .populate('customer', 'customerName customerPhone customerEmail') // Populate customer details in the edit request
                .lean();

            if (!requestedBillEdit) {
                throw new Error('Bill Edit Request not found for the provided editBillReqId');
            }

            // No need to populate the full bill details within requestedBillEdit
            // As the bill is not required to be fully populated, only the necessary fields are fetched

            // 2. Integrate real-time quantityInStore for the requested bill edit
            await this.fetchRealTimeQuantity(requestedBillEdit);

            // Return the current bill separately if needed elsewhere in your application, not included in requestedBillEdit
            let currentBill
            if (requestedBillEdit.isApproved === null || requestedBillEdit.isApproved === false) {
                currentBill = await Bill.findById(requestedBillEdit.bill)
                    .populate({
                        path: 'customer',
                        select: 'customerName customerPhone customerEmail'
                    })
                    .lean();
            } else {
                currentBill = await OldBill.findById(requestedBillEdit.bill)
                    .populate({
                        path: 'customer',
                        select: 'customerName customerPhone customerEmail'
                    })
                    .lean();
            }

            // Return only the necessary details
            return {
                currentBill,
                requestedBillEdit
            };

        } catch (error) {
            console.error('Error fetching bill details:', error.message);
            throw new Error(error.message);
        }
    }

    // Helper function to fetch real-time quantityInStore for a bill's products
    async fetchRealTimeQuantity(bill) {
        for (const product of bill.products) {
            for (const variant of product.variants) {
                for (const variantSize of variant.variantSizes) {
                    const store = await Store.findOne({
                        'products.productId': product.productId,
                        'products.variants.variantId': variant.variantId,
                        'products.variants.variantSizes.size': variantSize.size
                    }, {
                        'products': 1 // Fetch all products matching the condition
                    });

                    if (store && store.products.length) {
                        // Find the correct product in the array of products
                        const storeProduct = store.products.find(p => p.productId === product.productId);

                        if (storeProduct) {
                            // Find the correct variant in the product
                            const matchedVariant = storeProduct.variants.find(v => v.variantId === variant.variantId);

                            if (matchedVariant) {
                                // Find the correct variant size in the variant
                                const matchedSize = matchedVariant.variantSizes.find(vs => vs.size === variantSize.size);

                                if (matchedSize) {
                                    variantSize.quantityInStore = matchedSize.quantity; // Add real-time quantityInStore
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    async getDetailedBillEditReqs() {//isApproved
        try {

            // // Parse the `isApproved` parameter correctly
            // let approvedFilter = {};
            // if (isApproved === "true") {
            //     approvedFilter.isApproved = true; // Update the filter
            // } else if (isApproved === "false") {
            //     approvedFilter.isApproved = false; // Update the filter
            // } else if (isApproved === "pending") {
            //     approvedFilter.isApproved = null; // Update the filter
            // }

            // Fetch all bill edit requests
            const billEditReqs = await BillEditReq.find({})//approvedFilter
                .populate('customer', 'customerId customerName customerPhone customerEmail')
                .lean();

            if (!billEditReqs.length) {
                return [];
            }

            const detailedBillEditReqs = await Promise.all(billEditReqs.map(async (billEditReq) => {
                // Fetch current or old bill details based on approval status
                let currentBill;
                if (billEditReq.isApproved === null || billEditReq.isApproved === false) {
                    currentBill = await Bill.findById(billEditReq.bill)
                        .populate({
                            path: 'customer',
                            select: 'customerId customerName customerPhone customerEmail'
                        })
                        .lean();
                } else {
                    currentBill = await OldBill.findById(billEditReq.bill)
                        .populate({
                            path: 'customer',
                            select: 'customerId customerName customerPhone customerEmail'
                        })
                        .lean();
                }

                // Add real-time quantityInStore for each product in the requested bill edit
                await this.fetchRealTimeQuty(billEditReq);

                return {
                    currentBill,
                    requestedBillEdit: billEditReq
                };
            }));

            return detailedBillEditReqs;
        } catch (error) {
            console.error('Error fetching detailed bill edit requests:', error.message);
            throw new Error(error.message);
        }
    }

    // Helper function to fetch real-time quantityInStore
    async fetchRealTimeQuty(bill) {
        for (const product of bill.products) {
            for (const variant of product.variants) {
                for (const variantSize of variant.variantSizes) {
                    const store = await Store.findOne({
                        'products.productId': product.productId,
                        'products.variants.variantId': variant.variantId,
                        'products.variants.variantSizes.size': variantSize.size
                    }, {
                        'products': 1 // Fetch all products matching the condition
                    });

                    if (store && store.products.length) {
                        const storeProduct = store.products.find(p => p.productId === product.productId);

                        if (storeProduct) {
                            const matchedVariant = storeProduct.variants.find(v => v.variantId === variant.variantId);

                            if (matchedVariant) {
                                const matchedSize = matchedVariant.variantSizes.find(vs => vs.size === variantSize.size);

                                if (matchedSize) {
                                    variantSize.quantityInStore = matchedSize.quantity;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    async validateBillEditReq(editBillReqId, isApproved, validateNote) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1. Find the Bill Edit Request by editBillReqId
            const billEditReq = await BillEditReq.findOne({ editBillReqId })
                .populate('bill customer')
                .session(session);

            if (!billEditReq) {
                throw new Error('Bill Edit Request not found');
            }

            const originalBill = billEditReq.bill;
            if (!originalBill) {
                throw new Error('Bill associated with the request not found');
            }

            // Handle rejection first
            if (isApproved == "false") {
                billEditReq.isApproved = false;
                billEditReq.dateOfValidate = new Date();
                originalBill.editStatus = 'REJECTED';

                await Promise.all([
                    originalBill.save({ session }),
                    billEditReq.save({ session })
                ]);

                await session.commitTransaction();
                session.endSession();

                return { message: 'Bill Edit Request rejected and Bill editStatus updated to REJECTED successfully.' };
            }

            // Handle approval flow
            const store = await Store.findOne({ storeId: originalBill.storeId }).session(session);
            if (!store) {
                throw new Error('Store not found');
            }

            // 2. Update customer information if necessary
            let existingCustomer = await Customer.findOne({
                customerPhone: billEditReq.customer.customerPhone,
                isCreated: true
            }).session(session);

            if (existingCustomer) {
                let isUpdated = false;

                if (existingCustomer.customerName !== billEditReq.customer.customerName) {
                    existingCustomer.customerName = billEditReq.customer.customerName;
                    isUpdated = true;
                }

                if (existingCustomer.customerEmail !== billEditReq.customer.customerEmail) {
                    existingCustomer.customerEmail = billEditReq.customer.customerEmail;
                    isUpdated = true;
                }

                if (isUpdated) {
                    await existingCustomer.save({ session });
                }
                billEditReq.customer = existingCustomer
                await Customer.deleteOne({ customerPhone: billEditReq.customer.customerPhone, isCreated: false }).session(session);
                await billEditReq.save({ session });
            } else {
                billEditReq.customer.isCreated = true;
                await billEditReq.save({ session });
            }

            // 3. Handle new products in BillEditReq that are not present in the original bill
            for (const editProduct of billEditReq.products) {
                let originalProduct = originalBill.products.find(p => p.productId === editProduct.productId);

                // If product doesn't exist in the original bill, it's a new product
                if (!originalProduct) {
                    for (const variant of editProduct.variants) {
                        for (const variantSize of variant.variantSizes) {
                            // Find the corresponding store inventory
                            const storeVariant = store.products.find(p => p.productId === editProduct.productId)
                                ?.variants.find(v => v.variantId === variant.variantId);

                            if (!storeVariant) {
                                throw new Error(`Store does not have variant ${variant.variantId} for product ${editProduct.productId}`);
                            }

                            const storeVariantSize = storeVariant.variantSizes.find(vs => vs.size === variantSize.size);
                            if (!storeVariantSize) {
                                throw new Error(`Store does not have size ${variantSize.size} for variant ${variant.variantId}`);
                            }

                            // Check if the store has sufficient quantity
                            if (storeVariantSize.quantity < variantSize.billedQuantity) {
                                throw new Error(`Insufficient quantity in store for styleCoat ${variantSize.styleCoat}, required: ${variantSize.billedQuantity}, available: ${storeVariantSize.quantity}`);
                            }

                            // Deduct the quantity in the store for the new product being added
                            storeVariantSize.quantity -= variantSize.billedQuantity;
                        }
                    }

                    // Add this new product to the original bill
                    originalBill.products.push(editProduct);
                    await store.save({ session });
                }
            }

            // 4. Handle products present in the original bill but not in BillEditReq (they are "removed")
            let removedItems = {
                products: [],
                variants: [],
                variantSizes: []
            };

            originalBill.products = originalBill.products.filter(originalProduct => {
                // Check if the product exists in BillEditReq
                const editProduct = billEditReq.products.find(p => p.productId === originalProduct.productId);

                // If the product doesn't exist in BillEditReq, it's considered removed
                if (!editProduct) {
                    removedItems.products.push({
                        productId: originalProduct.productId,
                        message: `Product with ID ${originalProduct.productId} removed`
                    });
                    return false; // Remove the product
                }

                // Product exists, now check for variants
                originalProduct.variants = originalProduct.variants.filter(originalVariant => {
                    const editVariant = editProduct.variants.find(v => v.variantId === originalVariant.variantId);

                    // If the variant doesn't exist in BillEditReq, it's considered removed
                    if (!editVariant) {
                        removedItems.variants.push({
                            productId: originalProduct.productId,
                            variantId: originalVariant.variantId,
                            message: `Variant with ID ${originalVariant.variantId} removed from product ${originalProduct.productId}`
                        });
                        return false; // Remove the variant
                    }

                    // Variant exists, now check for variantSizes
                    originalVariant.variantSizes = originalVariant.variantSizes.filter(originalVariantSize => {
                        const editVariantSize = editVariant.variantSizes.find(vs => vs.styleCoat === originalVariantSize.styleCoat);

                        // If the variantSize doesn't exist in BillEditReq, it's considered removed
                        if (!editVariantSize) {
                            removedItems.variantSizes.push({
                                productId: originalProduct.productId,
                                variantId: originalVariant.variantId,
                                styleCoat: originalVariantSize.styleCoat,
                                message: `VariantSize with styleCoat ${originalVariantSize.styleCoat} removed from variant ${originalVariant.variantId}`
                            });
                            return false; // Remove the variantSize
                        }

                        return true; // Keep the variantSize
                    });

                    // If all variantSizes of a variant are removed, the variant itself should be removed
                    return originalVariant.variantSizes.length > 0;
                });

                // If all variants of a product are removed, the product itself should be removed
                return originalProduct.variants.length > 0;
            });

            // Output the removed items for tracking
            console.log('Removed items:', removedItems);

            // 5. Create an oldBill copy of the original bill before changes
            const oldBill = new OldBill({
                billId: originalBill.billId,
                invoiceNo: originalBill.invoiceNo,
                invoiceUrl: originalBill.invoiceUrl,
                storeId: originalBill.storeId,
                customer: originalBill.customer,
                TotalAmount: originalBill.TotalAmount,
                discountPercentage: originalBill.discountPercentage,
                priceAfterDiscount: originalBill.priceAfterDiscount,
                products: originalBill.products,
                modeOfPayment: originalBill.modeOfPayment,
                dateOfBill: originalBill.dateOfBill,
                editStatus: 'APPROVED'
            });
            await oldBill.save({ session });

            // Update BillEditReq with reference to oldBill
            billEditReq.bill = oldBill._id;
            billEditReq.validateNote = validateNote;
            billEditReq.isApproved = true;
            billEditReq.dateOfValidate = new Date();

            // 6. Update the original bill with the changes from BillEditReq
            originalBill.customer = billEditReq.customer._id;
            originalBill.TotalAmount = billEditReq.TotalAmount;
            originalBill.discountPercentage = billEditReq.discountPercentage;
            originalBill.priceAfterDiscount = billEditReq.priceAfterDiscount;
            originalBill.products = billEditReq.products; // Update product details
            originalBill.editStatus = 'APPROVED';

            // Save everything within the session
            await Promise.all([
                originalBill.save({ session }),
                billEditReq.save({ session })
            ]);

            await session.commitTransaction();
            session.endSession();

            return {
                message: 'Bill Edit Request approved and bill updated successfully.',
                billId: originalBill.billId,
                invoiceNo: originalBill.invoiceNo,
                dateOfBill: originalBill.dateOfBill,
                customerDetails: billEditReq.customer,
                modeOfPayment: originalBill.modeOfPayment,
                billedProducts: originalBill.products,
                totalAmount: originalBill.TotalAmount,
                discountPercentage: originalBill.discountPercentage || 0, // Using the discount from request
                priceAfterDiscount: originalBill.priceAfterDiscount
            };

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.error('Error validating bill edit request:', error.message);
            throw new Error(error.message);
        }
    }
    async getStoreOverview(storeId) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            // Get the store using storeId
            const storeDetails = await Store.findOne({ storeId }).session(session);

            if (!storeDetails) {
                throw new Error("Store not found.");
            }

            // Aggregating the total billed amount, number of active bills, and number of deleted bills
            const result = await Bill.aggregate([
                { $match: { storeId } }, // Match bills by storeId
                {
                    $group: {
                        _id: null, // We don't need to group by any field, so we use null
                        totalBilledAmount: {
                            $sum: {
                                $cond: [{ $eq: ["$isDeleted", false] }, "$priceAfterDiscount", 0]
                            }
                        }, // Sum priceAfterDiscount for non-deleted bills
                        activeBillCount: {
                            $sum: { $cond: [{ $eq: ["$isDeleted", false] }, 1, 0] }
                        }, // Count bills where isDeleted is false
                        deletedBillCount: {
                            $sum: { $cond: [{ $eq: ["$isDeleted", true] }, 1, 0] }
                        } // Count bills where isDeleted is true
                    }
                }
            ]);

            // Extracting the values, defaulting to 0 if no matching documents are found
            const { totalBilledAmount = 0, activeBillCount = 0, deletedBillCount = 0 } = result.length > 0 ? result[0] : {};

            // Calculate commission earned
            const commissionPercentage = storeDetails.commissionPercentage || 0;
            const commissionEarned = (totalBilledAmount * commissionPercentage) / 100;

            // Commit transaction
            await session.commitTransaction();
            return {
                storeId,
                totalBilledAmount,
                activeBillCount,
                deletedBillCount,
                commissionPercentage,
                commissionEarned
            };
        } catch (error) {
            await session.abortTransaction();
            // Handle any errors that occur during the database query
            console.error("Error fetching store overview:", error);
            throw new Error("Could not fetch store overview");
        } finally {
            session.endSession(); // Ensure session is always ended
        }
    }

}

module.exports = StoreService;
