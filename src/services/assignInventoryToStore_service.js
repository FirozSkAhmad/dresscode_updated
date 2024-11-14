const mongoose = require('mongoose');
const Product = require('../utils/Models/productModel'); // Assuming this is your Product model path
const AssignedHistory = require('../utils/Models/assignedHistoryModel');
const Store = require('../utils/Models/storeModel');

class StoreService {
    constructor() { }

    async assignProductsToStore(storeId, productDetails) {
        try {
            const session = await mongoose.startSession();
            session.startTransaction();

            const store = await Store.findById(storeId).session(session);
            if (!store) {
                throw new Error('Store not found');
            }

            let totalAmountOfAssigned = 0;
            const productVariants = [];

            for (const details of productDetails) {
                const prodId = generateProdId(details.schoolName, details.productCategory, details.productName, details.gender, details.pattern);
                const product = await Product.findOne({ prodId: prodId }).session(session);
                if (!product) {
                    throw new Error(`Product not found with ID: ${prodId}`);
                }

                const variant = product.variants.find(v => v.size === details.size && v.color === details.color);
                if (!variant || variant.quantity < details.quantity) {
                    throw new Error(`Insufficient stock for product ${details.productName}, size: ${details.size}, color: ${details.color}`);
                }

                // Update quantity in the Product model
                variant.quantity -= details.quantity;
                await product.save({ session });

                // Record this assignment and calculate the assigned value
                const assignedValue = variant.price * details.quantity;
                totalAmountOfAssigned += assignedValue;  // Sum of price multiplied by quantity for each variant

                productVariants.push({
                    productId: product._id,
                    variantIdsQunatity: [{
                        variantId: variant._id,
                        quantityOfAssigned: details.quantity
                    }]
                });
            }

            // Create assigned history
            const assignedHistory = new AssignedHistory({
                totalAmountOfAssigned: totalAmountOfAssigned,
                productVariants: productVariants,
                status: 'ASSIGNED'
            });

            await assignedHistory.save({ session });

            // Update store with assigned history
            store.assignedIds.push({ assignedId: assignedHistory._id });
            await store.save({ session });

            await session.commitTransaction();
            session.endSession();
            return { success: true, message: "Products assigned successfully" };
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }


    // Helper function to generate a product ID based on the given criteria
    generateProdId(schoolName, productCategory, productName, gender, pattern) {
        return `SCHOOL_${schoolName}_${productCategory}_${productName}_${gender}_${pattern}`;
    }

    async getAssignedHistoryByStore(storeId) {
        try {
            const store = await Store.findById(storeId)
                .populate({
                    path: 'assignedIds.assignedId',
                    select: 'assignedDate totalAmountOfAssigned status' // Select only the necessary fields
                }).exec();

            if (!store || store.assignedIds.length === 0) {
                return { success: false, message: 'Store not found or no assigned history' };
            }

            const assignedHistories = store.assignedIds.map(item => item.assignedId).filter(history => history).sort((a, b) => new Date(b.assignedDate) - new Date(a.assignedDate));;
            return { success: true, data: assignedHistories };
        } catch (err) {
            console.error('Error retrieving assigned history:', err);
            throw err; // Let the caller handle the error
        }
    }
}

module.exports = StoreService;