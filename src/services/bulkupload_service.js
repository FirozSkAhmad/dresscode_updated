const EliteModel = require('../utils/Models/eliteModel');  // Ensure correct path
const stream = require('stream');
const csv = require('csv-parser');

class BulkUploadService {
    constructor() {}

    async processCsvFile(buffer) {
        const data = await this.parseCsv(buffer);
        await this.bulkInsertOrUpdate(data);  // Processing each entry
        return { status: 200, message: "Data processed successfully." };
    }

    parseCsv(buffer) {
        return new Promise((resolve, reject) => {
            const results = [];
            const bufferStream = new stream.PassThrough();
            bufferStream.end(buffer);

            bufferStream
                .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
                .on('data', (data) => {
                    results.push({
                        group: data.group,
                        category: data.category,
                        subCategory: data.subCategory,
                        gender: data.gender,
                        productType: data.productType,
                        fit: data.fit,
                        neckline: data.neckline,
                        sleeves: data.sleeves,
                        variant: {
                            size: data.variantSize,
                            color: data.variantColor,
                            quantity: parseInt(data.variantQuantity),
                            images: data.variantImages.split(';'),
                        }
                    });
                })
                .on('end', () => resolve(results))
                .on('error', (error) => reject(error));
        });
    }

    async bulkInsertOrUpdate(data) {
        // First, update existing products to add variants if they do not exist
        for (const item of data) {
            await this.addVariant(item);
        }
    }

    async addVariant(item) {
        const existingProduct = await EliteModel.findOne({
            group: item.group,
            category: item.category,
            subCategory: item.subCategory,
            gender: item.gender,
            productType: item.productType,
            fit: item.fit,
            neckline: item.neckline,
            sleeves: item.sleeves
        });

        if (existingProduct) {
            const variantExists = existingProduct.variants.findIndex(variant => 
                variant.size === item.variant.size && variant.color === item.variant.color);

            if (variantExists > -1) {
                // Variant exists, update its quantity
                const variantPath = `variants.${variantExists}.quantity`;
                await EliteModel.updateOne(
                    { _id: existingProduct._id },
                    { $inc: { [variantPath]: item.variant.quantity } }
                );
            } else {
                await EliteModel.updateOne(
                    { _id: existingProduct._id },
                    { $push: { variants: item.variant } }
                );
            }
        } else {
            // Create a new product if it does not exist
            await EliteModel.create({
                group: item.group,
                category: item.category,
                subCategory: item.subCategory,
                gender: item.gender,
                productType: item.productType,
                fit: item.fit,
                neckline: item.neckline,
                sleeves: item.sleeves,
                variants: [item.variant]
            });
        }
    }
}

module.exports = BulkUploadService;









