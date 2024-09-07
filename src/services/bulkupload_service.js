const HealModel = require('../utils/Models/healModel');
const ShieldModel = require('../utils/Models/shieldModel');
const EliteModel = require('../utils/Models/eliteModel');
const TogsModel = require('../utils/Models/togsModel');
const SpiritsModel = require('../utils/Models/spiritsModel');
const WorkWearModel = require('../utils/Models/workWearModel');
const UploadedHistoryModel = require('../utils/Models/uploadedHistoryModel');
const colorCodes = require('../utils/Helpers/data');
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

    async processHealsCsvFile(buffer, session) {
        const data = await this.parseHealCsv(buffer);
        const uploadResults = await this.bulkHealInsertOrUpdate(data, session);  // Processing each entry
        await this.recordUpload(uploadResults, session);
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
                            name: data.groupName.toUpperCase(),
                            imageUrl: data.groupImageUrl
                        },
                        category: {
                            name: data.categoryName.toUpperCase(),
                            imageUrl: data.categoryImageUrl
                        },
                        subCategory: {
                            name: data.subCategoryName.toUpperCase(),
                            imageUrl: data.subCategoryImageUrl
                        },
                        gender: data.gender.toUpperCase(),
                        productType: {
                            type: data.productType.toUpperCase(),
                            imageUrl: data.productTypeImageUrl
                        },
                        fit: data.fit.toUpperCase(),
                        sleeves: data.sleeves.toUpperCase(),
                        fabric: data.fabric.toUpperCase(),
                        price: data.price,
                        productDetails: data.productDetails,
                        variant: {
                            color: { name: data.variantColor, hexcode: colorCodes[data.variantColor.toUpperCase()] ? colorCodes[data.variantColor.toUpperCase()] : null },
                            variantSizes: [
                                {
                                    size: data.variantSize.toUpperCase(),
                                    quantity: parseInt(data.variantQuantity),
                                    sku: `${data.gender.toUpperCase()}-${data.productType}-${data.variantColor}-${data.variantSize}`,
                                },
                            ],
                            imageUrls: data.variantImages ? data.variantImages.split(';') : [],
                        }
                    });
                })
                .on('end', () => resolve(results))
                .on('error', (error) => reject(error));
        });
    }

    async bulkHealInsertOrUpdate(data, session) {
        let uploadData = [];

        for (const item of data) {
            let productData = await this.addHealVariant(item, session); // Include session in function call
            productData = Array.isArray(productData) ? productData[0] : productData
            if (productData) {
                let uploadEntry = uploadData.find(entry =>
                    entry.group === item.group.name &&
                    entry.productId?.toString() === item.productId?.toString()
                );

                let existingVariants = productData.variants.find(vs => vs.color.name === item.variant.color.name);
                let existingSizeEntry = existingVariants.variantSizes.find(vs => vs.size === item.variant.variantSizes[0].size)

                if (uploadEntry) {
                    let variantEntry = uploadEntry.variants.find(v => v.color.name === item.variant.color.name);
                    if (variantEntry) {
                        let sizeEntry = variantEntry.variantSizes.find(vs => vs.size === item.variant.variantSizes[0].size);
                        if (sizeEntry) {
                            sizeEntry.quantityOfUpload += item.variant.variantSizes[0].quantity;
                        } else {
                            variantEntry.variantSizes.push({
                                size: item.variant.variantSizes[0].size,
                                quantityOfUpload: item.variant.variantSizes[0].quantity,
                                styleCoat: existingSizeEntry.styleCoat,
                                sku: item.variant.variantSizes[0].sku
                            });
                        }
                    } else {
                        uploadEntry.variants.push({
                            color: item.variant.color,
                            variantSizes: item.variant.variantSizes.map(vs => ({
                                size: vs.size,
                                quantityOfUpload: vs.quantity,
                                styleCoat: existingSizeEntry.styleCoat,
                                sku: vs.sku,
                            }))
                        });
                    }
                } else {
                    uploadData.push({
                        group: item.group.name,
                        productId: productData.productId,
                        variants: [{
                            color: item.variant.color,
                            variantSizes: item.variant.variantSizes.map(vs => ({
                                size: vs.size,
                                quantityOfUpload: vs.quantity,
                                styleCoat: existingSizeEntry.styleCoat,
                                sku: vs.sku,
                            }))
                        }]
                    });
                }
            }
        }
        return uploadData;
    }

    async addHealVariant(item, session) {
        const existingProduct = await HealModel.findOne({
            'group.name': item.group.name,
            'category.name': item.category.name,
            'subCategory.name': item.subCategory.name,
            gender: item.gender,
            'productType.type': item.productType.type,
            fit: item.fit,
            sleeves: item.sleeves,
            fabric: item.fabric
        }, null, { session });

        if (existingProduct) {
            const variant = existingProduct.variants.find(v => v.color.name === item.variant.color.name);
            if (variant) {
                // Update existing variant's details or add new size details
                const sizeDetail = variant.variantSizes.find(v => v.size === item.variant.variantSizes[0].size);
                if (sizeDetail) {
                    sizeDetail.quantity += item.variant.variantSizes[0].quantity;
                } else {
                    variant.variantSizes.push(item.variant.variantSizes[0]);
                }
                await existingProduct.save({ session });  // Save updates
            } else {
                // Push new variant if color does not exist
                existingProduct.variants.push(item.variant);
                await existingProduct.save({ session });
            }
            return existingProduct;
        } else {
            // Create new product if it does not exist
            return await HealModel.create([{
                group: item.group,
                category: item.category,
                subCategory: item.subCategory,
                gender: item.gender,
                productType: item.productType,
                fit: item.fit,
                sleeves: item.sleeves,
                fabric: item.fabric,
                price: item.price,
                productDescription: item.productDescription,
                variants: [item.variant]
            }], { session });
        }
    }

    async processShieldsCsvFile(buffer, session) {
        const data = await this.parseShieldCsv(buffer);
        const uploadResults = await this.bulkShieldInsertOrUpdate(data, session);  // Processing each entry
        await this.recordUpload(uploadResults, session);
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
                        price: data.price,
                        productDetails: data.productDetails,
                        variant: {
                            color: { name: data.variantColor, hexcode: colorCodes[data.variantColor] ? colorCodes[data.variantColor] : null },
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
        // for (const item of data) {
        //     await this.addShieldVariant(item);
        // }
        let uploadData = [];
        for (const item of data) {
            const productData = await this.addShieldVariant(item, session); // Include session in function call
            productData = Array.isArray(productData) ? productData[0] : productData
            if (productData) {
                let uploadEntry = uploadData.find(entry =>
                    entry.group === item.group.name &&
                    entry.productId?.toString() === productData.productId?.toString()
                );

                if (uploadEntry) {
                    let variantEntry = uploadEntry.variants.find(v => v.color.name === item.variant.color.name);
                    if (variantEntry) {
                        let sizeEntry = variantEntry.variantSizes.find(vs => vs.size === item.variant.variantSizes[0].size);
                        if (sizeEntry) {
                            sizeEntry.quantityOfUpload += item.variant.variantSizes[0].quantity;
                        } else {
                            variantEntry.variantSizes.push({
                                size: item.variant.variantSizes[0].size,
                                quantityOfUpload: item.variant.variantSizes[0].quantity
                            });
                        }
                    } else {
                        uploadEntry.variants.push({
                            color: item.variant.color,
                            variantSizes: item.variant.variantSizes.map(vs => ({
                                size: vs.size,
                                quantityOfUpload: vs.quantity
                            }))
                        });
                    }
                } else {
                    uploadData.push({
                        group: item.group.name,
                        productId: productData.productId,
                        variants: [{
                            color: item.variant.color,
                            variantSizes: item.variant.variantSizes.map(vs => ({
                                size: vs.size,
                                quantityOfUpload: vs.quantity
                            }))
                        }]
                    });
                }
            }
        }
        return uploadData;
    }

    async addShieldVariant(item, session) {
        const existingProduct = await ShieldModel.findOne({
            'group.name': item.group.name,
            'category.name': item.category.name,
            'subCategory.name': item.subCategory.name,
            gender: item.gender,
            'productType.type': item.productType.type,
            fit: item.fit ? item.fit : "CLASSIC FITS",
            fabric: item.fabric ? item.fabric : "POLY COTTON",
        }, null, { session });

        if (existingProduct) {
            const variant = existingProduct.variants.find(v => v.color.name === item.variant.color.name);
            if (variant) {
                // Update existing variant's details or add new size details
                const sizeDetail = variant.variantSizes.find(v => v.size === item.variant.variantSizes[0].size);
                if (sizeDetail) {
                    sizeDetail.quantity += item.variant.variantSizes[0].quantity;
                } else {
                    variant.variantSizes.push(item.variant.variantSizes[0]);
                }
                await existingProduct.save({ session });  // Save updates
            } else {
                // Push new variant if color does not exist
                existingProduct.variants.push(item.variant);
                await existingProduct.save({ session });
            }
            return existingProduct;
        } else {
            // Create new product if it does not exist
            return await ShieldModel.create([{
                group: item.group,
                category: item.category,
                subCategory: item.subCategory,
                gender: item.gender,
                productType: item.productType,
                fit: item.fit,
                fabric: item.fabric,
                variants: [item.variant]
            }], { session });
        }
    }

    async processEliteCsvFile(buffer, session) {
        const data = await this.parseEliteCsv(buffer);
        const uploadResults = await this.bulkEliteInsertOrUpdate(data, session);  // Processing each entry within the transaction
        await this.recordUpload(uploadResults, session);
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
                        group: data.groupName.toUpperCase(),
                        category: data.categoryName.toUpperCase(),
                        subCategory: data.subCategoryName.toUpperCase(),
                        gender: data.gender.toUpperCase(),
                        productType: data.productType.toUpperCase(),
                        fit: data.fit.toUpperCase(),
                        neckline: data.neckline.toUpperCase(),
                        pattern: data.pattern.toUpperCase(),
                        cuff: data.cuff.toUpperCase(),
                        sleeves: data.sleeves.toUpperCase(),
                        material: data.material.toUpperCase(),
                        price: data.price,
                        productDescription: data.productDescription,
                        variant: {
                            color: { name: data.variantColor, hexcode: data.hexcode },
                            variantSizes: [
                                {
                                    size: data.variantSize.toUpperCase(),
                                    quantity: parseInt(data.variantQuantity),
                                    sku: `${data.gender.toUpperCase()}-${data.productType}-${data.variantColor}-${data.variantSize}`,
                                },
                            ],
                            imageUrls: data.variantImages ? data.variantImages.split(';') : [],
                        }
                    });
                })
                .on('end', () => resolve(results))
                .on('error', (error) => reject(error));
        });
    }

    async bulkEliteInsertOrUpdate(data, session) {
        let uploadData = [];

        for (const item of data) {
            let productData = await this.addEliteVariant(item, session); // Include session in function call
            productData = Array.isArray(productData) ? productData[0] : productData

            if (productData) {
                let uploadEntry = uploadData.find(entry =>
                    entry.group === productData.group &&
                    entry.productId?.toString() === item.productId?.toString()
                );

                let existingVariants = productData.variants.find(vs => vs.color.name === item.variant.color.name);
                let existingSizeEntry = existingVariants.variantSizes.find(vs => vs.size === item.variant.variantSizes[0].size)

                if (uploadEntry) {
                    let variantEntry = uploadEntry.variants.find(v => v.color.name === item.variant.color.name);
                    if (variantEntry) {
                        let sizeEntry = variantEntry.variantSizes.find(vs => vs.size === item.variant.variantSizes[0].size);
                        if (sizeEntry) {
                            sizeEntry.quantityOfUpload += item.variant.variantSizes[0].quantity;
                        } else {
                            variantEntry.variantSizes.push({
                                size: item.variant.variantSizes[0].size,
                                quantityOfUpload: item.variant.variantSizes[0].quantity,
                                styleCoat: existingSizeEntry.styleCoat,
                                sku: item.variant.variantSizes[0].sku
                            });
                        }
                    } else {
                        uploadEntry.variants.push({
                            color: item.variant.color,
                            variantSizes: item.variant.variantSizes.map(vs => ({
                                size: vs.size,
                                quantityOfUpload: vs.quantity,
                                styleCoat: existingSizeEntry.styleCoat,
                                sku: vs.sku,
                            }))
                        });
                    }
                } else {
                    uploadData.push({
                        group: item.group,
                        productId: productData.productId,
                        variants: [{
                            color: item.variant.color,
                            variantSizes: item.variant.variantSizes.map(vs => ({
                                size: vs.size,
                                quantityOfUpload: vs.quantity,
                                styleCoat: existingSizeEntry.styleCoat,
                                sku: vs.sku,
                            }))
                        }]
                    });
                }
            }
        }
        return uploadData;
    }

    async addEliteVariant(item, session) {
        try {
            const existingProduct = await EliteModel.findOne({
                group: item.group,
                category: item.category,
                subCategory: item.subCategory,
                gender: item.gender,
                productType: item.productType,
                fit: item.fit,
                neckline: item.neckline,
                pattern: item.pattern,
                cuff: item.cuff,
                sleeves: item.sleeves,
                material: item.material,
            }, null, { session });
    
            if (existingProduct) {
                const variant = existingProduct.variants.find(v => v.color.name === item.variant.color.name);
                if (variant) {
                    const sizeDetail = variant.variantSizes.find(v => v.size === item.variant.variantSizes[0].size);
                    if (sizeDetail) {
                        sizeDetail.quantity += item.variant.variantSizes[0].quantity;
                    } else {
                        variant.variantSizes.push(item.variant.variantSizes[0]);
                    }
                    await existingProduct.save({ session });
                } else {
                    existingProduct.variants.push(item.variant);
                    await existingProduct.save({ session });
                }
                return existingProduct;
            } else {
                // Create new product if it does not exist
                return await EliteModel.create([{
                    group: item.group,
                    category: item.category,
                    subCategory: item.subCategory,
                    gender: item.gender,
                    productType: item.productType,
                    fit: item.fit,
                    neckline: item.neckline,
                    pattern: item.pattern,
                    cuff: item.cuff,
                    sleeves: item.sleeves,
                    material: item.material,
                    price: item.price,
                    productDescription: item.productDescription,
                    variants: [item.variant]
                }], { session });
            }
        } catch (error) {
            console.error("Error adding variant to Elite product:", error.message);
            throw new Error("Failed to add or update variant"); // Rethrow the error to handle it in upper layers if necessary
        }
    }
    

    async processTogsCsvFile(buffer, session) {
        const data = await this.parseTogsCsv(buffer);
        const uploadResults = await this.bulkTogsInsertOrUpdate(data, session);
        await this.recordUpload(uploadResults, session);
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
                            name: data.groupName.toUpperCase(),
                            imageUrl: data.groupImageUrl
                        },
                        category: {
                            name: data.categoryName.toUpperCase(),
                            imageUrl: data.categoryImageUrl
                        },
                        subCategory: {
                            name: data.subCategoryName.toUpperCase(),
                            imageUrl: data.subCategoryImageUrl
                        },
                        gender: data.gender.toUpperCase(),
                        productType: {
                            type: data.productType.toUpperCase(),
                            imageUrl: data.productTypeImageUrl
                        },
                        fit: data.fit.toUpperCase(),
                        neckline: data.neckline.toUpperCase(),
                        pattern: data.pattern.toUpperCase(),
                        sleeves: data.sleeves.toUpperCase(),
                        material: data.material.toUpperCase(),
                        price: data.price,
                        productDescription: data.productDescription,
                        variant: {
                            color: { name: data.variantColor, hexcode: colorCodes[data.variantColor.toUpperCase()] ? colorCodes[data.variantColor.toUpperCase()] : null },
                            variantSizes: [
                                {
                                    size: data.variantSize.toUpperCase(),
                                    quantity: parseInt(data.variantQuantity),
                                    sku: `${data.gender.toUpperCase()}-${data.productType.toUpperCase()}-${data.variantColor.toUpperCase()}-${data.variantSize.toUpperCase()}`,
                                },
                            ],
                            imageUrls: data.variantImages ? data.variantImages.split(';') : [],
                        }
                    });
                })
                .on('end', () => resolve(results))
                .on('error', (error) => reject(error));
        });
    }

    async bulkTogsInsertOrUpdate(data, session) {
        let uploadData = [];

        for (const item of data) {
            let productData = await this.addTogsVariant(item, session); // Include session in function call
            productData = Array.isArray(productData) ? productData[0] : productData
            if (productData) {
                let uploadEntry = uploadData.find(entry =>
                    entry.group === item.group.name &&
                    entry.productId?.toString() === item.productId?.toString()
                );

                let existingVariants = productData.variants.find(vs => vs.color.name === item.variant.color.name);
                let existingSizeEntry = existingVariants.variantSizes.find(vs => vs.size === item.variant.variantSizes[0].size)

                if (uploadEntry) {
                    let variantEntry = uploadEntry.variants.find(v => v.color.name === item.variant.color.name);
                    if (variantEntry) {
                        let sizeEntry = variantEntry.variantSizes.find(vs => vs.size === item.variant.variantSizes[0].size);
                        if (sizeEntry) {
                            sizeEntry.quantityOfUpload += item.variant.variantSizes[0].quantity;
                        } else {
                            variantEntry.variantSizes.push({
                                size: item.variant.variantSizes[0].size,
                                quantityOfUpload: item.variant.variantSizes[0].quantity,
                                styleCoat: existingSizeEntry.styleCoat,
                                sku: item.variant.variantSizes[0].sku
                            });
                        }
                    } else {
                        uploadEntry.variants.push({
                            color: item.variant.color,
                            variantSizes: item.variant.variantSizes.map(vs => ({
                                size: vs.size,
                                quantityOfUpload: vs.quantity,
                                styleCoat: existingSizeEntry.styleCoat,
                                sku: vs.sku,
                            }))
                        });
                    }
                } else {
                    uploadData.push({
                        group: item.group.name,
                        productId: productData.productId,
                        variants: [{
                            color: item.variant.color,
                            variantSizes: item.variant.variantSizes.map(vs => ({
                                size: vs.size,
                                quantityOfUpload: vs.quantity,
                                styleCoat: existingSizeEntry.styleCoat,
                                sku: vs.sku,
                            }))
                        }]
                    });
                }
            }
        }
        return uploadData;
    }

    async addTogsVariant(item, session) {
        const existingProduct = await TogsModel.findOne({
            'group.name': item.group.name,
            'category.name': item.category.name,
            'subCategory.name': item.subCategory.name,
            gender: item.gender,
            'productType.type': item.productType.type,
            fit: item.fit,
            neckline: item.neckline,
            pattern: item.pattern,
            sleeves: item.sleeves,
            material: item.material
        }, null, { session });

        if (existingProduct) {
            const variant = existingProduct.variants.find(v => v.color.name === item.variant.color.name);
            if (variant) {
                // Update existing variant's details or add new size details
                const sizeDetail = variant.variantSizes.find(v => v.size === item.variant.variantSizes[0].size);
                if (sizeDetail) {
                    sizeDetail.quantity += item.variant.variantSizes[0].quantity;
                } else {
                    variant.variantSizes.push(item.variant.variantSizes[0]);
                }
                await existingProduct.save({ session });  // Save updates
            } else {
                // Push new variant if color does not exist
                existingProduct.variants.push(item.variant);
                await existingProduct.save({ session });
            }
            return existingProduct;
        } else {
            // Create new product if it does not exist
            return await TogsModel.create([{
                group: item.group,
                category: item.category,
                subCategory: item.subCategory,
                gender: item.gender,
                productType: item.productType,
                fit: item.fit,
                neckline: item.neckline,
                pattern: item.pattern,
                sleeves: item.sleeves,
                material: item.material,
                price: item.price,
                productDetails: item.productDetails,
                variants: [item.variant]
            }], { session });
        }
    }

    async processSpiritsCsvFile(buffer, session) {
        const data = await this.parseSpiritsCsv(buffer);
        const uploadResults = await this.bulkSpiritsInsertOrUpdate(data, session);  // Processing each entry
        await this.recordUpload(uploadResults, session);
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
                            color: { name: data.variantColor ? data.variantColor : 'SPIRITS COLOR', hexcode: colorCodes[data.variantColor] ? colorCodes[data.variantColor] : null },
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
        // for (const item of data) {
        //     await this.addSpiritsVariant(item);
        // }
        let uploadData = [];
        for (const item of data) {
            const productData = await this.addEliteVariant(item, session); // Include session in function call
            productData = Array.isArray(productData) ? productData[0] : productData
            if (productData) {
                let uploadEntry = uploadData.find(entry =>
                    entry.group === item.group.name &&
                    entry.productId.toString() === productData.productId.toString()
                );

                if (uploadEntry) {
                    let variantEntry = uploadEntry.variants.find(v => v.color.name === item.variant.color.name);
                    if (variantEntry) {
                        let sizeEntry = variantEntry.variantSizes.find(vs => vs.size === item.variant.variantSizes[0].size);
                        if (sizeEntry) {
                            sizeEntry.quantityOfUpload += item.variant.variantSizes[0].quantity;
                        } else {
                            variantEntry.variantSizes.push({
                                size: item.variant.variantSizes[0].size,
                                quantityOfUpload: item.variant.variantSizes[0].quantity
                            });
                        }
                    } else {
                        uploadEntry.variants.push({
                            color: item.variant.color,
                            variantSizes: item.variant.variantSizes.map(vs => ({
                                size: vs.size,
                                quantityOfUpload: vs.quantity
                            }))
                        });
                    }
                } else {
                    uploadData.push({
                        group: item.group.name,
                        productId: productData._id,
                        variants: [{
                            color: item.variant.color,
                            variantSizes: item.variant.variantSizes.map(vs => ({
                                size: vs.size,
                                quantityOfUpload: vs.quantity
                            }))
                        }]
                    });
                }
            }
        }
        return uploadData;
    }

    async addSpiritsVariant(item) {
        const existingProduct = await SpiritsModel.findOne({
            'group.name': item.group.name,
            'category.name': item.category.name,
            gender: item.gender,
            'productType.type': item.productType.type,
            neckline: item.neckline ? item.neckline : null,
            sleeves: item.sleeves ? item.sleeves : null,
        }, null, { session });

        if (existingProduct) {
            const variant = existingProduct.variants.find(v => v.color.name === item.variant.color.name);
            if (variant) {
                const sizeDetail = variant.variantSizes.find(v => v.size === item.variant.variantSizes[0].size);
                if (sizeDetail) {
                    sizeDetail.quantity += item.variant.variantSizes[0].quantity;
                } else {
                    variant.variantSizes.push(item.variant.variantSizes[0]);
                }
                await existingProduct.save({ session });
            } else {
                existingProduct.variants.push(item.variant);
                await existingProduct.save({ session });
            }
            return existingProduct;
        } else {
            // Create new product if it does not exist
            return await SpiritsModel.create([{
                group: item.group,
                category: item.category,
                gender: item.gender,
                productType: item.productType,
                neckline: item.neckline ? item.neckline : null,
                sleeves: item.sleeves ? item.sleeves : null,
                variants: [item.variant]
            }], { session });
        }
    }

    async processWorkWearCsvFile(buffer, session) {
        const data = await this.parseWorkWearCsv(buffer);
        const uploadResults = await this.bulkWorkWearInsertOrUpdate(data, session);  // Processing each entry
        await this.recordUpload(uploadResults, session);
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
                        price: data.price,
                        productDetails: data.productDetails,
                        variant: {
                            color: { name: data.data.variantColor ? data.variantColor : "WORK WEAR COLOR", hexcode: colorCodes[data.variantColor] ? colorCodes[data.variantColor] : null },
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

    async bulkWorkWearInsertOrUpdate(data, session) {
        // First, update existing products to add variants if they do not exist
        // for (const item of data) {
        //     await this.addWorkWearVariant(item);
        // }

        let uploadData = [];
        for (const item of data) {
            const productData = await this.addWorkWearVariant(item, session); // Include session in function call
            productData = Array.isArray(productData) ? productData[0] : productData
            if (productData) {
                let uploadEntry = uploadData.find(entry =>
                    entry.group === item.group.name &&
                    entry.productId?.toString() === productData.productId?.toString()
                );

                if (uploadEntry) {
                    let variantEntry = uploadEntry.variants.find(v => v.color.name === item.variant.color.name);
                    if (variantEntry) {
                        let sizeEntry = variantEntry.variantSizes.find(vs => vs.size === item.variant.variantSizes[0].size);
                        if (sizeEntry) {
                            sizeEntry.quantityOfUpload += item.variant.variantSizes[0].quantity;
                        } else {
                            variantEntry.variantSizes.push({
                                size: item.variant.variantSizes[0].size,
                                quantityOfUpload: item.variant.variantSizes[0].quantity
                            });
                        }
                    } else {
                        uploadEntry.variants.push({
                            color: item.variant.color,
                            variantSizes: item.variant.variantSizes.map(vs => ({
                                size: vs.size,
                                quantityOfUpload: vs.quantity
                            }))
                        });
                    }
                } else {
                    uploadData.push({
                        group: item.group.name,
                        productId: productData.productId,
                        variants: [{
                            color: item.variant.color,
                            variantSizes: item.variant.variantSizes.map(vs => ({
                                size: vs.size,
                                quantityOfUpload: vs.quantity
                            }))
                        }]
                    });
                }
            }
        }
        return uploadData;
    }

    async addWorkWearVariant(item, session) {
        const existingProduct = await WorkWearModel.findOne({
            'group.name': item.group.name,
            'category.name': item.category.name,
            gender: item.gender,
            'productType.type': item.productType.type,
            fit: item.fit
        }, null, { session });

        if (existingProduct) {
            const variant = existingProduct.variants.find(v => v.color.name === item.variant.color.name);
            if (variant) {
                // Update existing variant's details or add new size details
                const sizeDetail = variant.variantSizes.find(v => v.size === item.variant.variantSizes[0].size);
                if (sizeDetail) {
                    sizeDetail.quantity += item.variant.variantSizes[0].quantity;
                } else {
                    variant.variantSizes.push(item.variant.variantSizes[0]);
                }
                await existingProduct.save({ session });  // Save updates
            } else {
                // Push new variant if color does not exist
                existingProduct.variants.push(item.variant);
                await existingProduct.save({ session });
            }
            return existingProduct;
        } else {
            // Create new product if it does not exist
            return await WorkWearModel.create([{
                group: item.group,
                category: item.category,
                gender: item.gender,
                productType: item.productType,
                fit: item.fit,
                variants: [item.variant]
            }], { session });
        }
    }

    async recordUpload(uploadData, session) {
        let totalAmountOfUploaded = 0;
        for (const product of uploadData) {
            const ProductModel = modelMap[product.group]
            const productDetails = await ProductModel.findOne({ productId: product.productId }, null, { session });

            for (const variant of product.variants) {
                const variantTotal = variant.variantSizes.reduce((sizeTotal, size) => {
                    return sizeTotal + (size.quantityOfUpload * productDetails.price);
                }, 0);
                totalAmountOfUploaded += variantTotal;
            }
        }

        return UploadedHistoryModel.create([{
            totalAmountOfUploaded,
            products: uploadData
        }], { session });
    }
}

module.exports = BulkUploadService;









