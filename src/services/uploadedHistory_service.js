const UploadedHistory = require('../utils/Models/uploadedHistoryModel'); // Mongoose model
const Product = require('../utils/Models/productModel'); // Mongoose model
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

class UplodedHistoryService {
    constructor() {
    }

    async getUploadedInvHistory() {
        try {
            const histories = await UploadedHistory.find({}).sort({ uploadedDate: -1 }).select('uploadedDate totalAmountOfUploaded -_id').lean();
            const formattedHistories = histories.map(history => ({
                UploadID: history._id, // Assuming you want to show the MongoDB ObjectId as "Upload ID"
                DateOfUpload: history.uploadedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
                TotalAmount: history.totalAmountOfUploaded
            }));
            return { status: 'success', data: formattedHistories };
        } catch (err) {
            console.error("Error retrieving uploaded inventory history:", err);
            throw err; // Re-throw the error for handling in the route
        }
    }

    async getUploadHistoryById(uploadId) {
        try {
            const history = await UploadedHistory.findById(uploadId)
                .populate({
                    path: 'productVariants.productId',
                    populate: {
                        path: 'variants.variantId'
                    }
                })
                .exec();

            if (!history) {
                return { status: 'error', message: 'Upload history not found' };
            }

            const items = history.productVariants.flatMap(pv =>
                pv.variantIdsQunatity.map(vq => {
                    const variant = vq.variantId; // Assuming `variantId` is populated
                    return {
                        productId: pv.productId.productId, // Ensure this is the correct field
                        category: pv.productId.category,
                        schoolName: pv.productId.schoolName || 'N/A',
                        productCategory: pv.productId.productCategory,
                        GarmentName: pv.productId.productName,
                        Gender: pv.productId.gender,
                        Pattern: pv.productId.pattern || 'N/A',
                        Color: variant.color,
                        Size: variant.size,
                        Quantity: vq.quantityOfUploaded,
                        Price: variant.price
                    };
                })
            );

            const formattedData = {
                // UploadID: history._id.toString(),
                // DateOfUpload: history.uploadedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
                // TotalAmount: history.totalAmountOfUploaded,
                Items: items,
                TotalPrice: items.reduce((sum, item) => sum + (item.Price * item.Quantity), 0) // Calculate total price
            };

            return { status: 'success', data: formattedData };
        } catch (error) {
            console.error('Failed to retrieve upload history:', error);
            return { status: 'error', message: 'Failed to retrieve data', error: error.message };
        }
    }

}
module.exports = UplodedHistoryService;