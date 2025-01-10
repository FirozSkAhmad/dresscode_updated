const HealModel = require('../utils/Models/healModel');
const EliteModel = require('../utils/Models/eliteModel');
const TogsModel = require('../utils/Models/togsModel');
const UploadedHistoryModel = require('../utils/Models/uploadedHistoryModel');
const stream = require('stream');
const csv = require('csv-parser');

const modelMap = {
    "HEAL": HealModel,
    "ELITE": EliteModel,
    "TOGS": TogsModel
};


class BulkUploadService {
    constructor() { }

    validateData(group, data, rowNumber) {
        // Common required fields
        const commonFields = ['groupName', 'categoryName', 'subCategoryName', 'gender', 'productType', 'variantColor', 'variantSize', 'variantQuantity', 'price', 'productDescription', 'sizeChart', 'hexcode', 'variantImages'];
        const groupSpecificFields = {
            'HEAL': ['fit', 'sleeves', 'fabric'],
            'ELITE': ['fit', 'neckline', 'pattern', 'cuff', 'sleeves', 'material'],
            'TOGS': ['fit', 'neckline', 'pattern', 'sleeves', 'material']
        };

        const requiredFields = commonFields.concat(groupSpecificFields[group] || []);

        for (let field of requiredFields) {
            if (!data[field]) {
                throw new Error(`Missing required field:${field} in CSV file at row ${rowNumber}.`);
            }
        }
    }

    assembleValidatedData(group, data, schoolName) {
        const baseData = {
            group: data.groupName.trim().toUpperCase(),
            category: data.categoryName.trim().toUpperCase(),
            subCategory: data.subCategoryName.trim().toUpperCase(),
            gender: data.gender.trim().toUpperCase(),
            productType: data.productType.trim().toUpperCase(),
            price: parseFloat(data.price),
            productDescription: data.productDescription.trim(),
            sizeChart: data.sizeChart.trim(),
            variant: {
                color: {
                    name: data.variantColor.trim().toUpperCase(),
                    hexcode: data.hexcode.trim()
                },
                variantSizes: [{
                    size: data.variantSize.trim().toUpperCase(),
                    quantity: parseInt(data.variantQuantity),
                    sku: `${data.gender.trim().toUpperCase()}-${data.productType.trim().toUpperCase()}-${data.variantColor.trim()}-${data.variantSize.trim()}`,
                    hsnCode: data.hsnCode
                }],
                imageUrls: data.variantImages ? data.variantImages.split(';').map(url => url.trim()) : []
            }
        };

        // Add group-specific fields
        switch (group) {
            case 'HEAL':
                baseData.fit = data.fit.trim().toUpperCase();
                baseData.sleeves = data.sleeves.trim().toUpperCase();
                baseData.fabric = data.fabric.trim().toUpperCase();
                break;
            case 'ELITE':
                baseData.fit = data.fit.trim().toUpperCase();
                baseData.neckline = data.neckline.trim().toUpperCase();
                baseData.pattern = data.pattern.trim().toUpperCase();
                baseData.cuff = data.cuff.trim().toUpperCase();
                baseData.sleeves = data.sleeves.trim().toUpperCase();
                baseData.material = data.material.trim().toUpperCase();
                break;
            case 'TOGS':
                baseData.fit = data.fit.trim().toUpperCase();
                baseData.neckline = data.neckline.trim().toUpperCase();
                baseData.pattern = data.pattern.trim().toUpperCase();
                baseData.sleeves = data.sleeves.trim().toUpperCase();
                baseData.material = data.material.trim().toUpperCase();
                baseData.schoolName = schoolName.trim().toUpperCase();  // Conditionally add schoolName
                break;
        }

        return baseData;
    }

    async processCsvFile(group, buffer, session, schoolName) {
        try {
            let data;

            // Conditionally pass schoolName to parseCsv if group is 'TOGS'
            if (group === "TOGS") {
                data = await this.parseCsv(group, buffer, schoolName);  // Pass schoolName when group is TOGS
            } else {
                data = await this.parseCsv(group, buffer);  // No schoolName for other groups
            }
            const uploadResults = await this.bulkInsertOrUpdate(group, data, session);  // Processing each entry
            await this.recordUpload(uploadResults, session);
            return { status: 200, message: "Data processed successfully." };
        } catch (error) {
            throw new Error(error.message);
        }
    }

    parseCsv(group, buffer, schoolName) {
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
                        this.validateData(group, data, rowNumber);
                        const validatedData = this.assembleValidatedData(group, data, schoolName);
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


    async bulkInsertOrUpdate(group, data, session) {
        let uploadData = [];

        try {
            for (const item of data) {
                let productData = await this.addVariant(group, item, session); // Call the specific function based on the group
                productData = Array.isArray(productData) ? productData[0] : productData;

                if (productData) {
                    let uploadEntry = uploadData.find(entry =>
                        entry.group === productData.group &&
                        entry.productId?.toString() === item.productId?.toString()
                    );

                    let existingVariants = productData.variants.find(vs => vs.color.name === item.variant.color.name);
                    let existingSizeEntry = existingVariants.variantSizes.find(vs => vs.size === item.variant.variantSizes[0].size);

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
                                    sku: item.variant.variantSizes[0].sku,
                                    hsnCode: item.variant.variantSizes[0].hsnCode
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
                                    hsnCode: vs.hsnCode,
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
                                    hsnCode: vs.hsnCode,
                                }))
                            }]
                        });
                    }
                }
            }
            return uploadData;
        } catch (error) {
            console.error("Bulk insert/update error:", error);
            throw new Error(`Failed to process bulk insert/update for ${group}: ${error.message}`);
        }
    }

    async addVariant(group, item, session) {
        // Define specifics for different groups
        const schemaMap = {
            'HEAL': { additionalFields: ['sleeves', 'fabric'] },
            'ELITE': { additionalFields: ['neckline', 'pattern', 'cuff', 'sleeves', 'material'] },
            'TOGS': { additionalFields: ['neckline', 'pattern', 'sleeves', 'material', 'schoolName'] }
        };

        const Model = modelMap[group];
        const schemaDetails = schemaMap[group];

        try {
            // Construct the query object dynamically based on schema details
            const query = {
                group: item.group,
                category: item.category,
                subCategory: item.subCategory,
                gender: item.gender,
                productType: item.productType,
                fit: item.fit
            };

            // Add additional fields dynamically to the query
            schemaDetails.additionalFields.forEach(field => {
                query[field] = item[field];
            });

            const existingProduct = await Model.findOne(query, null, { session });

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
                return await Model.create([{
                    ...query,
                    price: item.price,
                    productDescription: item.productDescription,
                    sizeChart: item.sizeChart,
                    variants: [item.variant]
                }], { session });
            }
        } catch (error) {
            console.error(`Error adding variant to ${group} product:`, error.message);
            throw new Error(`Failed to add or update ${group} variant`);
        }
    }

    async recordUpload(uploadData, session) {
        try {
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
        } catch (error) {
            console.error("Failed to record upload data:", error.message);
            throw new Error(`Failed to record upload`);
        }
    }
}

module.exports = BulkUploadService;









