const HealModel = require('../utils/Models/healModel');
const ShieldModel = require('../utils/Models/shieldModel');
const EliteModel = require('../utils/Models/eliteModel');
const TogsModel = require('../utils/Models/togsModel');
const SpiritsModel = require('../utils/Models/spiritsModel');
const WorkWearModel = require('../utils/Models/workWearModel');
const UploadedHistoryModel = require('../utils/Models/uploadedHistoryModel');
const stream = require('stream');
const csv = require('csv-parser');

const modelMap = {
    "HEAL": HealModel,
    "SHIELD": ShieldModel,
    "ELITE": EliteModel,
    "TOGS": TogsModel,
    "SPIRIT": SpiritsModel,
    "WORK WEAR UNIFORMS": WorkWearModel
};

class BulkUploadService {
    constructor() { }

    async processHealsCsvFile(buffer) {
        const data = await this.parseHealCsv(buffer);
        await this.bulkHealInsertOrUpdate(data);  // Processing each entry
        return { status: 200, message: "Data processed successfully." };
    }

    parseHealCsv(buffer) {
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
                        sleeves: data.sleeves,
                        fabric: data.fabric,
                        variant: {
                            color: data.categoryName === "COATS" ? "COATS COLOR" : data.variantColor,
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

    async bulkHealInsertOrUpdate(data) {
        // First, update existing products to add variants if they do not exist
        for (const item of data) {
            await this.addHealVariant(item);
        }
    }

    async addHealVariant(item) {
        const existingProduct = await HealModel.findOne({
            'group.name': item.group.name,
            'category.name': item.category.name,
            'subCategory.name': item.subCategory.name,
            gender: item.gender,
            'productType.type': item.productType.type,
            fit: item.fit,
            sleeves: item.sleeves,
            fabric: item.fabric
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
            await HealModel.create({
                group: item.group,
                category: item.category,
                subCategory: item.subCategory,
                gender: item.gender,
                productType: item.productType,
                fit: item.fit,
                sleeves: item.sleeves,
                fabric: item.fabric,
                variants: [item.variant]
            });
        }
    }

    async processShieldsCsvFile(buffer) {
        const data = await this.parseShieldCsv(buffer);
        await this.bulkShieldInsertOrUpdate(data);  // Processing each entry
        return { status: 200, message: "Data processed successfully." };
    }

    parseShieldCsv(buffer) {
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
                        fit: data.fit ? data.fit : "CLASSIC FITS",
                        fabric: data.fabric ? data.fabric : "POLY COTTON",
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

    async bulkShieldInsertOrUpdate(data) {
        // First, update existing products to add variants if they do not exist
        for (const item of data) {
            await this.addShieldVariant(item);
        }
    }

    async addShieldVariant(item) {
        const existingProduct = await ShieldModel.findOne({
            'group.name': item.group.name,
            'category.name': item.category.name,
            'subCategory.name': item.subCategory.name,
            gender: item.gender,
            'productType.type': item.productType.type,
            fit: item.fit ? item.fit : "CLASSIC FITS",
            fabric: item.fabric ? item.fabric : "POLY COTTON",
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
            await ShieldModel.create({
                group: item.group,
                category: item.category,
                subCategory: item.subCategory,
                gender: item.gender,
                productType: item.productType,
                fit: item.fit,
                fabric: item.fabric,
                variants: [item.variant]
            });
        }
    }

    async processEliteCsvFile(buffer) {
        const data = await this.parseEliteCsv(buffer);
        const uploadResults = await this.bulkEliteInsertOrUpdate(data);  // Processing each entry
        await this.recordUpload(uploadResults)
        return { status: 200, message: "Data processed successfully." };
    }

    parseEliteCsv(buffer) {
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
                        price: data.price,
                        productDetails: data.productDetails,
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

    async bulkEliteInsertOrUpdate(data) {
        // First, update existing products to add variants if they do not exist
        // for (const item of data) {
        //     await this.addEliteVariant(item);
        // }

        let uploadData = [];

        for (const item of data) {
            const productData = await this.addEliteVariant(item);
            if (productData) {
                let uploadEntry = uploadData.find(entry =>
                    entry.group === item.group.name &&
                    entry.productId.toString() === productData._id.toString()
                );

                if (uploadEntry) {
                    let variantEntry = uploadEntry.variants.find(v => v.color === item.variant.color);
                    if (variantEntry) {
                        let sizeEntry = variantEntry.variantSizes.find(vs => vs.size === item.variant.variantSizes[0].size);
                        if (sizeEntry) {
                            sizeEntry.quantityOfUpload += item.variant.variantSizes[0].quantity; // Ensure correct property is used
                        } else {
                            variantEntry.variantSizes.push({
                                size: item.variant.variantSizes[0].size,
                                quantityOfUpload: item.variant.variantSizes[0].quantity // Set quantityOfUpload when adding new size
                            });
                        }
                    } else {
                        // Push the whole variant if it's not found
                        uploadEntry.variants.push({
                            color: item.variant.color,
                            variantSizes: item.variant.variantSizes.map(vs => ({
                                size: vs.size,
                                quantityOfUpload: vs.quantity // Set quantityOfUpload for new variants
                            }))
                        });
                    }
                } else {
                    // Push new entry if product doesn't exist in uploadData
                    uploadData.push({
                        group: item.group.name,
                        productId: productData.productId,
                        variants: [{
                            color: item.variant.color,
                            variantSizes: item.variant.variantSizes.map(vs => ({
                                size: vs.size,
                                quantityOfUpload: vs.quantity // Set quantityOfUpload for completely new product
                            }))
                        }]
                    });
                }
            }
        }
        return uploadData;
    }

    async addEliteVariant(item) {
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
            return existingProduct;
        } else {
            // Create new product if it does not exist
            return await EliteModel.create({
                group: item.group,
                category: item.category,
                subCategory: item.subCategory,
                gender: item.gender,
                productType: item.productType,
                fit: item.fit,
                neckline: item.neckline,
                sleeves: item.sleeves,
                price: item.price,
                productDetails: item.productDetails,
                variants: [item.variant]
            });
        }
    }

    async recordUpload(uploadData) {
        let totalAmountOfUploaded = 0;

        for (const product of uploadData) {
            const ProductModel = modelMap[product.group]
            const productDetails = await ProductModel.findOne({ productId: product.productId }); // Fetch product details including prices

            for (const variant of product.variants) {
                const variantTotal = variant.variantSizes.reduce((sizeTotal, size) => {
                    return sizeTotal + (size.quantityOfUpload * productDetails.price);
                }, 0);
                totalAmountOfUploaded += variantTotal;
            }
        }
        return UploadedHistoryModel.create({
            totalAmountOfUploaded,
            products: uploadData
        });
    }

    async processTogsCsvFile(buffer) {
        const data = await this.parseTogsCsv(buffer);
        await this.bulkTogsInsertOrUpdate(data);  // Processing each entry
        return { status: 200, message: "Data processed successfully." };
    }

    parseTogsCsv(buffer) {
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

    async bulkTogsInsertOrUpdate(data) {
        // First, update existing products to add variants if they do not exist
        for (const item of data) {
            await this.addTogsVariant(item);
        }
    }

    async addTogsVariant(item) {
        const existingProduct = await TogsModel.findOne({
            'group.name': item.group.name,
            'category.name': item.category.name,
            'subCategory.name': item.subCategory.name,
            gender: item.gender,
            'productType.type': item.productType.type,
            fit: item.fit
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
            await TogsModel.create({
                group: item.group,
                category: item.category,
                subCategory: item.subCategory,
                gender: item.gender,
                productType: item.productType,
                fit: item.fit,
                variants: [item.variant]
            });
        }
    }

    async processSpiritsCsvFile(buffer) {
        const data = await this.parseSpiritsCsv(buffer);
        await this.bulkSpiritsInsertOrUpdate(data);  // Processing each entry
        return { status: 200, message: "Data processed successfully." };
    }

    parseSpiritsCsv(buffer) {
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
                        gender: data.gender,
                        productType: {
                            type: data.productType,
                            imageUrl: data.productTypeImageUrl
                        },
                        neckline: data.neckline ? data.neckline : null,
                        sleeves: data.sleeves ? data.sleeves : null,
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

    async bulkSpiritsInsertOrUpdate(data) {
        // First, update existing products to add variants if they do not exist
        for (const item of data) {
            await this.addSpiritsVariant(item);
        }
    }

    async addSpiritsVariant(item) {
        const existingProduct = await SpiritsModel.findOne({
            'group.name': item.group.name,
            'category.name': item.category.name,
            gender: item.gender,
            'productType.type': item.productType.type,
            neckline: item.neckline ? item.neckline : null,
            sleeves: item.sleeves ? item.sleeves : null,
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
            await SpiritsModel.create({
                group: item.group,
                category: item.category,
                gender: item.gender,
                productType: item.productType,
                neckline: item.neckline ? item.neckline : null,
                sleeves: item.sleeves ? item.sleeves : null,
                variants: [item.variant]
            });
        }
    }

    async processWorkWearCsvFile(buffer) {
        const data = await this.parseWorkWearCsv(buffer);
        await this.bulkWorkWearInsertOrUpdate(data);  // Processing each entry
        return { status: 200, message: "Data processed successfully." };
    }

    parseWorkWearCsv(buffer) {
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
                        gender: data.gender,
                        productType: {
                            type: data.productType,
                            imageUrl: data.productTypeImageUrl
                        },
                        fit: data.fit,
                        variant: {
                            color: "WORK WEAR COLOR",
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

    async bulkWorkWearInsertOrUpdate(data) {
        // First, update existing products to add variants if they do not exist
        for (const item of data) {
            await this.addWorkWearVariant(item);
        }
    }

    async addWorkWearVariant(item) {
        const existingProduct = await WorkWearModel.findOne({
            'group.name': item.group.name,
            'category.name': item.category.name,
            gender: item.gender,
            'productType.type': item.productType.type,
            fit: item.fit
        });

        if (existingProduct) {
            const variant = existingProduct.variants[0];
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
            await WorkWearModel.create({
                group: item.group,
                category: item.category,
                gender: item.gender,
                productType: item.productType,
                fit: item.fit,
                variants: [item.variant]
            });
        }
    }
}

module.exports = BulkUploadService;









