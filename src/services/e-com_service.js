const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const HealCoatsModel = require('../utils/Models/healCoatsModel');
const HealScrubsModel = require('../utils/Models/healScrubsModel');
const ShieldModel = require('../utils/Models/shieldModel');
const EliteModel = require('../utils/Models/eliteModel');
const TogsModel = require('../utils/Models/togsModel');
const SpiritsModel = require('../utils/Models/spiritsModel');
const WorkWearModel = require('../utils/Models/workWearModel');
const UploadedHistoryModel = require('../utils/Models/uploadedHistoryModel');


class EComService {
    constructor() {
    }

    async getGroups() {
        return { groups: ["HEAL", "SHIELD", "ELITE", "TOGS", "SPIRIT", "WORK WEAR UNIFORMS"] }
    }

    async getCategories(groupName) {
        switch (groupName) {
            case "HEAL":
                return await HealScrubsModel.distinct('category');
            case "SHIELD":
                return await ShieldModel.distinct('category');
            case "ELITE":
                return await EliteModel.distinct('category');
            case "TOGS":
                return await TogsModel.distinct('category');
            case "SPIRIT":
                return await SpiritsModel.distinct('category');
            case "WORK WEAR UNIFORMS":
                return await WorkWearModel.distinct('category');
            default:
                // Handle cases where the group name doesn't match any of the above
                return []; // Or provide a more informative message/default behavior
        }
    }

    //getSubCategoriesByGroupAndcategory
    async getSubCategories(groupName, category) {
        let modelToUse; // Define a variable to hold the model to use

        switch (groupName) {
            case "HEAL":
                modelToUse = HealScrubsModel;
                break;
            case "SHIELD":
                modelToUse = ShieldModel;
                break;
            case "ELITE":
                modelToUse = EliteModel;
                break;
            case "TOGS":
                modelToUse = TogsModel;
                break;
            case "SPIRIT":
                modelToUse = SpiritsModel;
                break;
            case "WORK WEAR UNIFORMS":
                modelToUse = WorkWearModel;
                break;
            default:
                return []; // Or provide a more informative message
        }

        // Ensure category is provided and a valid model is chosen
        if (!category || !modelToUse) {
            return []; // Or provide an error message
        }

        const query = { category }; // Filter by the provided category
        return await modelToUse.distinct('subCategory', query); // Use distinct() with filter
    }

    async getProductsTypes(groupName, category, subCategory) {
        let modelToUse; // Define a variable to hold the model to use

        switch (groupName) {
            case "HEAL":
                modelToUse = HealScrubsModel;
                break;
            case "SHIELD":
                modelToUse = ShieldModel;
                break;
            case "ELITE":
                modelToUse = EliteModel;
                break;
            case "TOGS":
                modelToUse = TogsModel;
                break;
            case "SPIRIT":
                modelToUse = SpiritsModel;
                break;
            case "WORK WEAR UNIFORMS":
                modelToUse = WorkWearModel;
                break;
            default:
                return []; // Or provide a more informative message
        }

        // Ensure category, subCategory, and a valid model are chosen
        if (!category || !subCategory || !modelToUse) {
            return []; // Or provide an error message
        }

        const query = { category, subCategory }; // Filter by category and subCategory

        // Use aggregation framework with a custom set operation
        const results = await modelToUse.aggregate([
            { $match: query }, // Apply the filter
            {
                $group: {
                    _id: "$gender", // Group by gender
                    productTypes: {
                        $addToSet: {
                            $toUpper: "$productType" // Convert productType to uppercase for case-insensitive comparison
                        },
                    },
                },
            },
            {
                $project: {
                    _id: 0, // Exclude _id from the output
                    gender: "$_id", // Rename _id to gender
                    productTypes: 1, // Include productTypes
                },
            },
        ]);

        return results.map((result) => ({ ...result, productTypes: [...result.productTypes] })); // Ensure productTypes is a copy (optional for immutability)
    }

    async getProducts(groupName, category, subCategory, gender, productType) {
        const modelMap = {
            "HEAL": HealScrubsModel,
            "SHIELD": ShieldModel,
            "ELITE": EliteModel,
            "TOGS": TogsModel,
            "SPIRIT": SpiritsModel,
            "WORK WEAR UNIFORMS": WorkWearModel
        };

        const modelToUse = modelMap[groupName];

        if (!modelToUse || !category || !subCategory) {
            console.error("Invalid parameters provided");
            return { filters: {}, productsList: [] };
        }

        const query = { category, subCategory };
        if (gender) query.gender = gender;
        if (productType) query.productType = productType;

        try {
            const results = await modelToUse.aggregate([
                { $match: query },
                {
                    $facet: {
                        products: [{ $group: { _id: "$_id", doc: { $first: "$$ROOT" } } }],
                        fits: [{ $group: { _id: null, fits: { $addToSet: "$fit" } } }],
                        colors: [
                            { $unwind: "$variants" },
                            { $group: { _id: null, colors: { $addToSet: "$variants.color" } } }
                        ],
                        sizes: [
                            { $unwind: "$variants" },
                            { $group: { _id: null, sizes: { $addToSet: "$variants.size" } } }
                        ],
                        necklines: [{ $group: { _id: null, necklines: { $addToSet: "$neckline" } } }],
                        sleeves: [{ $group: { _id: null, sleeves: { $addToSet: "$sleeves" } } }]
                    }
                }
            ]);

            const { products, fits, colors, sizes, necklines, sleeves } = results[0];
            return {
                filters: {
                    fits: fits[0]?.fits || [],
                    colors: colors[0]?.colors || [],
                    sizes: sizes[0]?.sizes || [],
                    necklines: necklines[0]?.necklines || [],
                    sleeves: sleeves[0]?.sleeves || []
                },
                productsList: products.map(product => product.doc)
            };
        } catch (error) {
            console.error("Failed to fetch products:", error);
            return { filters: {}, productsList: [] };
        }
    }


    async getFits(groupName, category, subCategory, gender, productType) {
        let modelToUse; // Define a variable to hold the model to use

        switch (groupName) {
            case "HEAL":
                modelToUse = HealScrubsModel;
                break;
            case "SHIELD":
                modelToUse = ShieldModel;
                break;
            case "ELITE":
                modelToUse = EliteModel;
                break;
            case "TOGS":
                modelToUse = TogsModel;
                break;
            case "SPIRIT":
                modelToUse = SpiritsModel;
                break;
            case "WORK WEAR UNIFORMS":
                modelToUse = WorkWearModel;
                break;
            default:
                return []; // Or provide a more informative message
        }

        // Ensure category, subCategory, and a valid model are chosen
        if (!category || !subCategory || !modelToUse) {
            return []; // Or provide an error message
        }

        const query = {}; // Initialize an empty query object

        // Add filters based on provided parameters (if any)
        if (gender) {
            query.gender = gender;
        }
        if (productType) {
            query.productType = productType;
        }
        query.category = category;
        query.subCategory = subCategory;

        // Use aggregation framework to get unique fits
        const results = await modelToUse.aggregate([
            { $match: query }, // Apply the filter
            {
                $group: {
                    _id: null, // Use null to create a single group for all documents
                    fits: { $addToSet: "$fit" }, // Accumulate unique fit values
                },
            },
            {
                $project: {
                    fits: 1, // Include only the fits array
                },
            },
        ]);

        return results.length > 0 ? results[0].fits : []; // Return the fits array or an empty array if no results found
    }

    async getColors(groupName, category, subCategory, gender, productType) {
        let modelToUse; // Define a variable to hold the model to use

        switch (groupName) {
            case "HEAL":
                modelToUse = HealScrubsModel;
                break;
            case "SHIELD":
                modelToUse = ShieldModel;
                break;
            case "ELITE":
                modelToUse = EliteModel;
                break;
            case "TOGS":
                modelToUse = TogsModel;
                break;
            case "SPIRIT":
                modelToUse = SpiritsModel;
                break;
            case "WORK WEAR UNIFORMS":
                modelToUse = WorkWearModel;
                break;
            default:
                return []; // Or provide a more informative message
        }

        // Ensure category, subCategory, and a valid model are chosen
        if (!category || !subCategory || !modelToUse) {
            return []; // Or provide an error message
        }

        const query = {}; // Initialize an empty query object

        // Add filters based on provided parameters (if any)
        if (gender) {
            query.gender = gender;
        }
        if (productType) {
            query.productType = productType;
        }
        query.category = category;
        query.subCategory = subCategory;

        // Use aggregation framework to get unique colors
        const results = await modelToUse.aggregate([
            { $match: query }, // Apply the filter
            {
                $unwind: "$variants", // Unwind the variants array to access individual variants
            },
            {
                $group: {
                    _id: null, // Use null to create a single group for all documents
                    colors: { $addToSet: "$variants.color" }, // Accumulate unique color values
                },
            },
            {
                $project: {
                    colors: 1, // Include only the colors array
                },
            },
        ]);

        return results.length > 0 ? results[0].colors : []; // Return the colors array or an empty array if no results found
    }

    async getSizes(groupName, category, subCategory, gender, productType) {
        let modelToUse; // Define a variable to hold the model to use

        switch (groupName) {
            case "HEAL":
                modelToUse = HealScrubsModel;
                break;
            case "SHIELD":
                modelToUse = ShieldModel;
                break;
            case "ELITE":
                modelToUse = EliteModel;
                break;
            case "TOGS":
                modelToUse = TogsModel;
                break;
            case "SPIRIT":
                modelToUse = SpiritsModel;
                break;
            case "WORK WEAR UNIFORMS":
                modelToUse = WorkWearModel;
                break;
            default:
                return []; // Or provide a more informative message
        }

        // Ensure category, subCategory, and a valid model are chosen
        if (!category || !subCategory || !modelToUse) {
            return []; // Or provide an error message
        }

        const query = {}; // Initialize an empty query object

        // Add filters based on provided parameters (if any)
        if (gender) {
            query.gender = gender;
        }
        if (productType) {
            query.productType = productType;
        }
        query.category = category;
        query.subCategory = subCategory;

        // Use aggregation framework to get unique sizes
        const results = await modelToUse.aggregate([
            { $match: query }, // Apply the filter
            {
                $unwind: "$variants", // Unwind the variants array to access individual variants
            },
            {
                $group: {
                    _id: null, // Use null to create a single group for all documents
                    sizes: { $addToSet: "$variants.size" }, // Accumulate unique size values
                },
            },
            {
                $project: {
                    sizes: 1, // Include only the sizes array
                },
            },
        ]);

        return results.length > 0 ? results[0].sizes : []; // Return the sizes array or an empty array if no results found
    }

    async getNecklines(groupName, category, subCategory, gender, productType) {
        let modelToUse; // Define a variable to hold the model to use

        switch (groupName) {
            case "HEAL":
                modelToUse = HealScrubsModel;
                break;
            case "SHIELD":
                modelToUse = ShieldModel;
                break;
            case "ELITE":
                modelToUse = EliteModel;
                break;
            case "TOGS":
                modelToUse = TogsModel;
                break;
            case "SPIRIT":
                modelToUse = SpiritsModel;
                break;
            case "WORK WEAR UNIFORMS":
                modelToUse = WorkWearModel;
                break;
            default:
                return []; // Or provide a more informative message
        }

        // Ensure category, subCategory, and a valid model are chosen
        if (!category || !subCategory || !modelToUse) {
            return []; // Or provide an error message
        }

        const query = {}; // Initialize an empty query object

        // Add filters based on provided parameters (if any)
        if (gender) {
            query.gender = gender;
        }
        if (productType) {
            query.productType = productType;
        }
        query.category = category;
        query.subCategory = subCategory;

        // Use aggregation framework to get unique necklines
        const results = await modelToUse.aggregate([
            { $match: query }, // Apply the filter
            {
                $group: {
                    _id: null, // Use null to create a single group for all documents
                    necklines: { $addToSet: "$neckline" }, // Accumulate unique neckline values
                },
            },
            {
                $project: {
                    necklines: 1, // Include only the necklines array
                },
            },
        ]);

        return results.length > 0 ? results[0].necklines : []; // Return the necklines array or an empty array if no results found
    }

    async getSleeves(groupName, category, subCategory, gender, productType) {
        let modelToUse; // Define a variable to hold the model to use

        switch (groupName) {
            case "HEAL":
                modelToUse = HealScrubsModel;
                break;
            case "SHIELD":
                modelToUse = ShieldModel;
                break;
            case "ELITE":
                modelToUse = EliteModel;
                break;
            case "TOGS":
                modelToUse = TogsModel;
                break;
            case "SPIRIT":
                modelToUse = SpiritsModel;
                break;
            case "WORK WEAR UNIFORMS":
                modelToUse = WorkWearModel;
                break;
            default:
                return []; // Or provide a more informative message
        }

        // Ensure category, subCategory, and a valid model are chosen
        if (!category || !subCategory || !modelToUse) {
            return []; // Or provide an error message
        }

        const query = {}; // Initialize an empty query object

        // Add filters based on provided parameters (if any)
        if (gender) {
            query.gender = gender;
        }
        if (productType) {
            query.productType = productType;
        }
        query.category = category;
        query.subCategory = subCategory;

        // Use aggregation framework to get unique sleeves
        const results = await modelToUse.aggregate([
            { $match: query }, // Apply the filter
            {
                $group: {
                    _id: null, // Use null to create a single group for all documents
                    sleeves: { $addToSet: "$sleeves" }, // Accumulate unique sleeve values
                },
            },
            {
                $project: {
                    sleeves: 1, // Include only the sleeves array
                },
            },
        ]);

        return results.length > 0 ? results[0].sleeves : []; // Return the sleeves array or an empty array if no results found
    }

    async getProductsByFilters(groupName, category, subCategory, gender, productType, fit, color, size, neckline, sleeves) {
        const modelMap = {
            "HEAL": HealScrubsModel,
            "SHIELD": ShieldModel,
            "ELITE": EliteModel,
            "TOGS": TogsModel,
            "SPIRIT": SpiritsModel,
            "WORK WEAR UNIFORMS": WorkWearModel
        };

        const modelToUse = modelMap[groupName];

        if (!modelToUse || !category || !subCategory) {
            console.error("Invalid parameters provided");
            return [];
        }

        // Building the query dynamically based on provided parameters
        const matchQuery = {
            category,
            subCategory
        };

        // Add parameters if they are provided and are not empty
        if (gender) matchQuery.gender = gender;
        if (productType) matchQuery.productType = productType;
        if (fit) matchQuery.fit = fit;
        if (neckline) matchQuery.neckline = neckline;
        if (sleeves) matchQuery.sleeves = sleeves;

        try {
            const products = await modelToUse.aggregate([
                { $match: matchQuery },
                {
                    $project: {
                        _id: 1,
                        productId: 1,
                        group: 1,
                        product_name: 1,
                        description: 1,
                        category: 1,
                        subCategory: 1,
                        gender: 1,
                        productType: 1,
                        fit: 1,
                        neckline: 1,
                        sleeves: 1,
                        variants: {
                            $filter: {
                                input: "$variants",
                                as: "variant",
                                cond: {
                                    $and: [
                                        color ? { $eq: ["$$variant.color", color] } : {},
                                        size ? { $eq: ["$$variant.size", size] } : {},
                                    ]
                                }
                            }
                        }
                    }
                }
            ]);

            return products;
        } catch (error) {
            console.error("Failed to fetch products:", error);
            return [];
        }
    }

    async getProductVariantColors(groupName, productId) {
        const modelMap = {
            "HEAL": HealScrubsModel,
            "SHIELD": ShieldModel,
            "ELITE": EliteModel,
            "TOGS": TogsModel,
            "SPIRIT": SpiritsModel,
            "WORK WEAR UNIFORMS": WorkWearModel
        };

        const modelToUse = modelMap[groupName];

        if (!modelToUse) {
            console.error("Invalid groupName provided");
            return { colors: [] };//, sizes: []
        }

        try {
            const product = await modelToUse.findOne({ productId }).lean();

            if (!product) {
                console.log("Product not found");
                return { colors: [] };//, sizes: []
            }

            // Using a Set to ensure unique values
            // const sizes = new Set();
            const colors = new Set();

            if (product.variants && product.variants.length > 0) {
                product.variants.forEach(variant => {
                    // if (variant.size) sizes.add(variant.size);
                    if (variant.color) colors.add(variant.color);
                });
            }

            return {
                // sizes: Array.from(sizes),
                colors: Array.from(colors)
            };
        } catch (error) {
            console.error("Failed to fetch product details:", error);
            return { sizes: [], colors: [] };
        }
    }

    async getSizesByColor(groupName, productId, color) {
        const modelMap = {
            "HEAL": HealScrubsModel,
            "SHIELD": ShieldModel,
            "ELITE": EliteModel,
            "TOGS": TogsModel,
            "SPIRIT": SpiritsModel,
            "WORK WEAR UNIFORMS": WorkWearModel
        };

        const modelToUse = modelMap[groupName];

        if (!modelToUse) {
            console.error("Invalid groupName provided");
            return { sizes: [], message: "Invalid groupName or model not found." };
        }

        try {
            const product = await modelToUse.findOne({ productId }).lean();

            if (!product) {
                console.log("Product not found");
                return { sizes: [], message: "Product not found." };
            }

            // Using a Set to ensure unique sizes for the specified color
            const sizes = new Set();

            product.variants.forEach(variant => {
                if (variant.color === color) {
                    sizes.add(variant.size);
                }
            });

            return {
                sizes: Array.from(sizes),
                message: sizes.size > 0 ? "Sizes retrieved successfully." : "No sizes found for the specified color."
            };
        } catch (error) {
            console.error("Failed to fetch product details:", error);
            return { sizes: [], message: "Failed to fetch product details." };
        }
    }

    async getProductDetailsWithSpecificVariant(groupName, productId, size, color) {
        const modelMap = {
            "HEAL": HealScrubsModel,
            "SHIELD": ShieldModel,
            "ELITE": EliteModel,
            "TOGS": TogsModel,
            "SPIRIT": SpiritsModel,
            "WORK WEAR UNIFORMS": WorkWearModel
        };

        const modelToUse = modelMap[groupName];

        if (!modelToUse) {
            console.error("Invalid groupName provided");
            return null;
        }

        try {
            // Directly find the product and extract sizes and colors in one query
            const product = await modelToUse.findOne({ productId, "variants.size": size, "variants.color": color }).lean();

            if (!product) {
                console.log("Product not found");
                return null;
            }

            // Collect unique sizes and colors from variants
            // const sizes = new Set();
            const colors = new Set();

            product.variants.forEach(variant => {
                // sizes.add(variant.size);
                colors.add(variant.color);
            });

            // Find the specific variant that matches the size and color
            const specificVariant = product.variants.find(variant => variant.size === size && variant.color === color);

            return specificVariant ? {
                productDetails: {
                    ...product,
                    variants: specificVariant ? [specificVariant] : [] // Only include the matching variant
                },
                // allSizes: Array.from(sizes),
                allColors: Array.from(colors)
            } : {
                message: "This product has no variants available with given size and color combination.",
                // allSizes: Array.from(sizes),
                allColors: Array.from(colors)
            };
        } catch (error) {
            console.error("Failed to fetch product details:", error);
            return null;
        }
    }

}
module.exports = EComService;