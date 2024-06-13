const csv = require('csv-parser');
const stream = require('stream');
const ProductModel = require('../utils/Models/productModel');
const AssignedHistoryModel = require('../utils/Models/assignedHistoryModel');
const StoreModel = require('../utils/Models/storeModel')

class BulkUpload {
    constructor() {
    }

    async processCsvFile(buffer, category, storeType, storeId) {
        try {
            const results = await this.parseCsv(buffer);
            return this.uploadDataBasedOnType(results, category, storeType, storeId);
        } catch (err) {
            console.error('processCsvFile error:', err.message);
            throw new Error("An internal server error occurred");
        }
    }

    parseCsv(buffer) {
        return new Promise((resolve, reject) => {
            const results = [];
            const bufferStream = new stream.PassThrough();
            bufferStream.end(buffer);

            bufferStream
                .pipe(csv({
                    mapHeaders: ({ header }) => header.trim() // Adjust header names to remove any potential whitespace
                }))
                .on('data', (data) => results.push(data))
                .on('end', () => resolve(results))
                .on('error', (error) => reject(error));
        });
    }

    async uploadDataBasedOnType(data, category, storeType, storeId) {
        try {
            return this.bulkInsert(ProductModel, data, category, storeType, storeId);
        } catch (err) {
            console.error('uploadDataBasedOnType error:', err.message);
            throw new Error("An internal server error occurred");
        }
    }

    async bulkInsert(Model, data, category, storeType, storeId) {

        if (storeType === "WARE_HOUSE") {
            const warehouse = await StoreModel.findOne({ storeType: "WARE_HOUSE" }, '_id');
            storeId = warehouse ? warehouse._id : storeId;
        }

        const assignedHistory = new AssignedHistoryModel({
            totalAmountOfAssigned: data.reduce((sum, item) => sum + parseInt(item['quantity']) * parseFloat(item['price']), 0),
            status: storeType === "WARE_HOUSE" ? "RECEIVED" : "ASSIGNED",
            productVariants: []  // This will hold product and variant references
        });
        await assignedHistory.save();  // Save to obtain an ID

        try {
            for (const item of data) {
                const prodId = this.generateProdId(category, item['school_name'], item['product_category'], item['product_name'], item['gender'], item['pattern']);
                const existingProduct = await Model.findOne({ prodId });
                let productId;
                let variantIds = [];

                const variant = {
                    size: item['variant_size'],
                    color: item['variant_color'],
                    quantity: parseInt(item['quantity']),
                    price: parseFloat(item['price']),
                    images: item['images'].split(';'),
                };

                if (existingProduct) {
                    const existingVariant = existingProduct.variants.find(v => v.size === variant.size && v.color === variant.color);

                    if (existingVariant) {
                        const storeEntry = existingVariant.quantityByStores.find(store => store.storeId.equals(storeId));
                        if (storeEntry) {
                            storeEntry.presentQuantity += variant.quantity;
                            storeEntry.assignedHistory.push({
                                assignedHistoryId: assignedHistory._id,
                                quantityOfAssigned: variant.quantity
                            });
                        } else {
                            existingVariant.quantityByStores.push({
                                storeId: storeId,
                                presentQuantity: variant.quantity,
                                assignedHistory: [{
                                    assignedHistoryId: assignedHistory._id,
                                    quantityOfAssigned: variant.quantity
                                }]
                            });
                        }
                        existingVariant.quantity += variant.quantity;
                    } else {
                        existingProduct.variants.push({
                            ...variant,
                            quantityByStores: [{
                                storeId: storeId,
                                presentQuantity: variant.quantity,
                                assignedHistory: [{
                                    assignedHistoryId: assignedHistory._id,
                                    quantityOfAssigned: variant.quantity
                                }]
                            }]
                        });
                    }
                    await existingProduct.save();
                } else {
                    const newProduct = new Model({
                        ...item,
                        prodId,
                        variants: [{
                            ...variant,
                            quantityByStores: [{
                                storeId: item['store_id'],
                                presentQuantity: variant.quantity,
                                assignedHistory: [{
                                    assignedHistoryId: assignedHistory._id,
                                    quantityOfAssigned: variant.quantity
                                }]
                            }]
                        }]
                    });
                    await newProduct.save();
                }
            }

            return { status: 200, message: `${data.length} products data added successfully.` };
        } catch (err) {
            console.error('Bulk insert error:', err.message);
            throw new Error("An internal server error occurred");
        }
    }

    arraysEqual(arr1, arr2) {
        return arr1.length === arr2.length && arr1.every(element => arr2.includes(element)) && arr2.every(element => arr1.includes(element));
    }

    generateProdId(category, school_name, product_category, product_name, gender, pattern) {
        return category === "SCHOOL" ? `${category}_${school_name}_${product_category}_${product_name}_${gender}_${pattern}` : category === "CORPORATE" ? `${category}_${product_category}_${product_name}_${gender}_${pattern}` : `${category}_${product_category}_${product_name}_${gender}`;
    }
}

module.exports = BulkUpload;




