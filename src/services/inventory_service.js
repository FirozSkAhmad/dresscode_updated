const ProductModel = require('../utils/Models/productModel');
const HealModel = require('../utils/Models/healModel');
const EliteModel = require('../utils/Models/eliteModel');
const TogsModel = require('../utils/Models/togsModel');
const UploadedHistoryModel = require('../utils/Models/uploadedHistoryModel');

class InventoryService {
    constructor() {
    }

    async uploadInventory(data, category) {
        try {
            // Initialize Uploaded History with empty product variants
            const uploadedHistory = new UploadedHistoryModel({
                totalAmountOfUploaded: data.reduce((sum, item) => sum + parseInt(item.quantity) * parseFloat(item.price), 0),
                productVariants: []
            });
            await uploadedHistory.save();

            // Process bulk insertion of products and update the uploaded history
            const result = await this.bulkInsert(ProductModel, data, category, uploadedHistory);
            return result;
        } catch (err) {
            console.error('uploadInventory error:', err.message);
            throw new Error("An internal server error occurred");
        }
    }

    async bulkInsert(Model, data, category, uploadedHistory) {
        try {
            for (const item of data) {
                const prodId = this.generateProdId(category, item.schoolName, item.productCategory, item.productName, item.gender, item.pattern);
                const existingProduct = await Model.findOne({ prodId });
                let productId;
                let variantIds = [];

                const variant = {
                    size: item.size,
                    color: item.color,
                    quantity: parseInt(item.quantity),
                    price: parseFloat(item.price),
                    images: item.images.split(';'),
                };

                if (existingProduct) {
                    productId = existingProduct._id;
                    variantIds = await this.updateOrCreateVariants(existingProduct, variant);
                } else {
                    const newProduct = await this.createProduct(Model, item, variant, prodId);
                    productId = newProduct._id;
                    variantIds = [newProduct.variants[0]._id];
                }

                // Update UploadedHistory with new productVariant details
                uploadedHistory.productVariants.push({
                    productId: productId,
                    variantIdsQunatity: variantIds.map(variantId => ({
                        variantId: variantId,
                        quantityOfUploaded: variant.quantity
                    }))
                });
            }

            await uploadedHistory.save();
            return { status: 200, message: `${data.length} products data added successfully.` };
        } catch (err) {
            console.error('Bulk insert error:', err.message);
            throw new Error("An internal server error occurred");
        }
    }

    async updateOrCreateVariants(product, variant) {
        let variantIds = [];
        const existingVariant = product.variants.find(v => v.size === variant.size && v.color === variant.color);
        if (existingVariant) {
            existingVariant.quantity += variant.quantity; // Always update quantity
            if (existingVariant.price !== variant.price) {
                existingVariant.price = variant.price; // Update price if different
            }
            if (JSON.stringify(existingVariant.images) !== JSON.stringify(variant.images)) {
                existingVariant.images = variant.images; // Update images if different
            }
            await product.save();
            variantIds.push(existingVariant._id);
        } else {
            product.variants.push(variant);
            await product.save();
            variantIds.push(product.variants.find(v => v.size === variant.size && v.color === variant.color)._id);
        }
        return variantIds;
    }

    async createProduct(Model, item, variant, prodId) {
        const newProduct = new Model({
            ...item,
            prodId,
            variants: [variant]
        });
        await newProduct.save();
        return newProduct; // Return the new product object
    }

    generateProdId(category, school_name, product_category, product_name, gender, pattern) {
        return category === "SCHOOL" ? `${category}_${school_name}_${product_category}_${product_name}_${gender}_${pattern}` : category === "CORPORATE" ? `${category}_${product_category}_${product_name}_${gender}_${pattern}` : `${category}_${product_category}_${product_name}_${gender}`;
    }

    async uploadHealProduct(data) {
        try {
            const { category } = data
            const newHeal = new HealModel(data)
            await newHeal.save();
            return { status: 201, message: "New heal added successfully!", data: newHeal };
        } catch (error) {
            return { status: 400, message: "Error adding new coat", error: error.message };
        }
    }

    async uploadEliteProduct(data) {
        try {
            const newElite = new EliteModel(data);
            await newElite.save();
            return { status: 201, message: "New elite added successfully!", data: newElite };
        } catch (error) {
            return { status: 400, message: "Error adding new elite", error: error.message };
        }
    }

    async uploadTogsProduct(data) {
        try {
            const newTogs = new TogsModel(data);
            await newTogs.save();
            return { status: 201, message: "New tog added successfully!", data: newTogs };
        } catch (error) {
            return { status: 400, message: "Error adding new tog", error: error.message };
        }
    }

    async getAllProducts() {
        try {
            const products = await ProductModel.find({}).populate('variants'); // Only use populate if variants are references to another collection
            const formattedProducts = products.flatMap(product =>
                product.variants.map(variant => ({
                    productId: product.productId,  // Ensure this is the correct field
                    category: product.category,
                    schoolName: product.schoolName || 'N/A',
                    productCategory: product.productCategory,
                    productName: product.productName,
                    gender: product.gender,
                    pattern: product.pattern || 'N/A',  // Default to 'N/A' if no pattern is available
                    color: variant.color,
                    size: variant.size,
                    quantity: variant.quantity,
                    price: variant.price
                }))
            );

            res.json({ status: 'success', data: formattedProducts });
        } catch (err) {
            console.error('uploadInventory error:', err.message);
            throw new Error("An internal server error occurred");
        }
    }
}

module.exports = InventoryService;

