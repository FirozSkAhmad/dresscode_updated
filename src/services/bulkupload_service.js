const EliteModel = require('../utils/Models/eliteModel');  // Ensure correct path
const stream = require('stream');
const csv = require('csv-parser');

class BulkUploadService {
    constructor() { }

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
                        group: {
                            name: data.groupName,
                            imageUrl: data.groupImageUrl
                        },
                        category: {
                            name: data.categoryName,
                            imageUrl: data.categoryImageUrl
                        },
                        subCategory: {
                            name: data.subCategoryName,
                            imageUrl: data.subCategoryImageUrl
                        },
                        gender: data.gender,
                        productType: {
                            type: data.productType,
                            imageUrl: data.productTypeImageUrl
                        },
                        fit: data.fit,
                        neckline: data.neckline,
                        sleeves: data.sleeves,
                        variant: {
                            color: data.variantColor,
                            variantSizes: [
                                {
                                    size: data.variantSize,
                                    quantity: parseInt(data.variantQuantity),
                                }
                            ],
                            imageUrls: data.variantImages ? data.variantImages.split(';') : [],
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
            'group.name': item.group.name,
            'category.name': item.category.name,
            'subCategory.name': item.subCategory.name,
            gender: item.gender,
            'productType.type': item.productType.type,
            fit: item.fit,
            neckline: item.neckline,
            sleeves: item.sleeves
        });

        if (existingProduct) {
            const variant = existingProduct.variants.find(v => v.color === item.variant.color);
            if (variant) {
                // Update existing variant's details or add new size details
                const sizeDetail = variant.variantSizes.find(v => v.size === item.variant.variantSizes[0].size);
                if (sizeDetail) {
                    sizeDetail.quantity += item.variant.variantSizes[0].quantity;
                } else {
                    variant.variantSizes.push(item.variant.variantSizes[0]);
                }
                await existingProduct.save();  // Save updates
            } else {
                // Push new variant if color does not exist
                existingProduct.variants.push(item.variant);
                await existingProduct.save();
            }
        } else {
            // Create new product if it does not exist
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









