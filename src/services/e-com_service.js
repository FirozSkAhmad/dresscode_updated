const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const HealModel = require('../utils/Models/healModel');
const EliteModel = require('../utils/Models/eliteModel');
const TogsModel = require('../utils/Models/togsModel');
const UploadedHistoryModel = require('../utils/Models/uploadedHistoryModel');
const modelMap = {
    "HEAL": HealModel,
    "ELITE": EliteModel,
    "TOGS": TogsModel,
};


class EComService {
    constructor() {
    }

    async getGroups() {
        const models = {
            HEAL: HealModel,
            ELITE: EliteModel,
            TOGS: TogsModel,
        };

        const groups = ["HEAL", "ELITE", "TOGS"];
        const groupDetails = [];

        try {
            for (const groupName of groups) {
                const model = models[groupName.replace(/\s+/g, '_')]; // Replace spaces for keys like "WORK WEAR UNIFORMS"
                const result = await model.findOne({
                    "group.name": groupName,
                    isDeleted: false
                }, {
                    "group.imageUrl": 1, _id: 0
                });

                // Check if a result was found and it includes an imageUrl
                if (result && result.group && result.group.imageUrl) {
                    groupDetails.push({
                        groupName: groupName,
                        imageUrl: result.group.imageUrl
                    });
                } else {
                    // Handle cases where no image is available
                    groupDetails.push({
                        groupName: groupName,
                        imageUrl: "default-image-url" // Placeholder for a default image
                    });
                }
            }

            return groupDetails;
        } catch (error) {
            console.error(`Error retrieving group images: ${error}`);
            throw new Error('Failed to fetch group images.');
        }
    }

    async getCategories(groupName) {
        try {
            let model;
            switch (groupName) {
                case "HEAL":
                    model = HealModel;
                    break;
                case "SHIELD":
                    model = ShieldModel;
                    break;
                case "ELITE":
                    model = EliteModel;
                    break;
                case "TOGS":
                    model = TogsModel;
                    break;
                case "SPIRIT":
                    model = SpiritsModel;
                    break;
                case "WORK WEAR UNIFORMS":
                    model = WorkWearModel;
                    break;
                default:
                    // Handle cases where the group name doesn't match any of the known groups
                    throw new Error(`Unsupported group name: ${groupName}`);
            }

            // Use the aggregation pipeline to ensure unique category data
            const result = await model.aggregate([
                { $match: { isDeleted: false } }, // Filter out deleted items
                {
                    $group: { // Group by category name and imageUrl to ensure uniqueness
                        _id: { name: "$category" },//, imageUrl: "$category.imageUrl" 
                        category: { $first: "$category" },
                    }
                },
                {
                    $project: { // Project the necessary fields
                        _id: 0,
                        category: "$category"
                    }
                }
            ]);

            return result;
        } catch (error) {
            // Log error or handle it according to your application's error management policy
            console.error(`Error retrieving categories for group ${groupName}: ${error}`);
            return []; // Return an empty array or handle the error as appropriate
        }
    }


    //getSubCategoriesByGroupAndcategory
    async getSubCategories(groupName, category) {
        let modelToUse; // Define a variable to hold the model to use

        switch (groupName) {
            case "HEAL":
                modelToUse = HealModel;
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
                return []; // Return an empty array if an invalid group is provided
        }

        // Ensure category is provided and a valid model is chosen
        if (!category || !modelToUse) {
            return []; // Return an empty array if no category is provided
        }

        try {
            // Use the aggregation pipeline to filter by category and group by subCategory
            const result = await modelToUse.aggregate([
                { $match: { 'category.name': category } }, // Match documents by category name
                {
                    $group: { // Group by subCategory name and imageUrl to ensure uniqueness
                        _id: { name: "$subCategory.name", imageUrl: "$subCategory.imageUrl" },
                        subCategory: { $first: "$subCategory.name" },
                        imageUrl: { $first: "$subCategory.imageUrl" }
                    }
                },
                {
                    $project: { // Project the necessary fields
                        _id: 0,
                        subCategory: "$subCategory",
                        imageUrl: "$imageUrl"
                    }
                }
            ]);

            return result;
        } catch (error) {
            console.error(`Error retrieving subcategories for group ${groupName} and category ${category}: ${error}`);
            return []; // Return an empty array in case of an error
        }
    }


    async getProductTypes(groupName, category, subCategory) {
        let modelToUse; // Define a variable to hold the model to use

        switch (groupName) {
            case "HEAL":
                modelToUse = HealModel;
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
                return []; // Return an empty array if an invalid group is provided
        }

        // Ensure category, subCategory, and a valid model are chosen
        // if (!category || !subCategory || !modelToUse) {
        //     return []; // Return an empty array if any essential input is missing
        // }

        const query = { 'category.name': category, 'subCategory.name': subCategory }; // Filter by category and subCategory

        // Use aggregation framework with a custom set operation
        const results = await modelToUse.aggregate([
            { $match: query }, // Apply the filter
            {
                $group: {
                    _id: "$gender", // Group by gender
                    productTypes: {
                        $addToSet: {
                            type: "$productType.type", // Extract type from productType
                            imageUrl: "$productType.imageUrl" // Extract imageUrl from productType
                        }
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

        return results;
    }


    async getProductFilters(groupName, category, subCategory, gender, productType) {

        const modelToUse = modelMap[groupName];

        // if (!modelToUse || !category || !subCategory) {
        //     console.error("Invalid parameters provided");
        //     return { filters: {} };
        // }

        const query = {
            "category.name": category,
            "subCategory.name": subCategory
        };
        if (gender) query.gender = gender;
        if (productType) query["productType.type"] = productType;

        try {
            const results = await modelToUse.aggregate([
                { $match: query },
                {
                    $facet: {
                        fits: [{ $group: { _id: null, fits: { $addToSet: "$fit" } } }],
                        fabrics: [{ $group: { _id: null, fabrics: { $addToSet: "$fabric" } } }],
                        colors: [
                            { $unwind: "$variants" },
                            { $group: { _id: null, colors: { $addToSet: "$variants.color" } } }
                        ],
                        sizes: [
                            { $unwind: "$variants" },
                            { $unwind: "$variants.variantSizes" },
                            { $match: { "variants.variantSizes.quantity": { $gt: 5 } } },
                            { $group: { _id: null, sizes: { $addToSet: "$variants.variantSizes.size" } } }
                        ],
                        necklines: [{ $group: { _id: null, necklines: { $addToSet: "$neckline" } } }],
                        sleeves: [{ $group: { _id: null, sleeves: { $addToSet: "$sleeves" } } }],
                        cuff: [{ $group: { _id: null, cuff: { $addToSet: "$cuff" } } }],
                        pattern: [{ $group: { _id: null, pattern: { $addToSet: "$pattern" } } }],
                        material: [{ $group: { _id: null, material: { $addToSet: "$material" } } }]
                    }
                }
            ]);

            const { fits, colors, sizes, fabrics, necklines, sleeves, cuff, pattern, material } = results[0];
            if (groupName === "HEAL") {
                if (category === "COATS") {
                    return {
                        fabrics: fabrics[0]?.fabrics || [],
                        sleeves: sleeves[0]?.sleeves || [],
                        sizes: sizes[0]?.sizes || [],
                    }
                } else {
                    return {
                        fabrics: fabrics[0]?.fabrics || [],
                        colors: colors[0]?.colors || [],
                        sizes: sizes[0]?.sizes || [],
                    }
                }

            }
            else if (groupName === "WORK WEAR UNIFORMS" || groupName === "SHIELD") {
                return {
                    colors: colors[0]?.colors || [],
                    sizes: sizes[0]?.sizes || [],
                }
            } else if (groupName === "SPIRIT") {
                if (['JACKETS', 'JERSEY T-SHIRT'].includes(productType)) {
                    return {
                        filters: {
                            colors: colors[0]?.colors || [],
                            sizes: sizes[0]?.sizes || [],
                            necklines: necklines[0]?.necklines || [],
                            sleeves: sleeves[0]?.sleeves || []
                        }
                    }
                } else {
                    return {
                        colors: colors[0]?.colors || [],
                        sizes: sizes[0]?.sizes || [],
                    }
                }
            } else if (groupName === "TOGS") {
                return {
                    filters: {
                        fits: fits[0]?.fits || [],
                        colors: colors[0]?.colors || [],
                        sizes: sizes[0]?.sizes || [],
                    }
                }
            }
            else {
                return {
                    filters: {
                        fits: fits[0]?.fits || [],
                        colors: colors[0]?.colors || [],
                        sizes: sizes[0]?.sizes || [],
                        necklines: necklines[0]?.necklines || [],
                        sleeves: sleeves[0]?.sleeves || [],
                        cuff: cuff[0]?.cuff || [],
                        pattern: pattern[0]?.pattern || [],
                        material: material[0]?.material || [],
                    }
                }
            };
        } catch (error) {
            console.error("Failed to fetch products:", error);
            return { filters: {} };
        }
    }

    async getFiltersByGroup(groupName) {
        try {
            const modelToUse = modelMap[groupName];

            const filters = await modelToUse.aggregate([
                { $match: { group: groupName } },
                { $unwind: "$variants" }, // Unwind the variants array to process each element
                { $unwind: "$variants.variantSizes" }, // Unwind the variantSizes array to access individual sizes
                { $match: { "variants.variantSizes.quantity": { $gt: 0 } } }, // Match sizes where quantity > 0
                {
                    $group: {
                        _id: null,
                        category: { $addToSet: "$category" },
                        subCategory: { $addToSet: "$subCategory" },
                        gender: { $addToSet: "$gender" },
                        productType: { $addToSet: "$productType" },
                        fit: { $addToSet: "$fit" },
                        neckline: { $addToSet: "$neckline" },
                        pattern: { $addToSet: "$pattern" },
                        cuff: { $addToSet: "$cuff" },
                        sleeves: { $addToSet: "$sleeves" },
                        material: { $addToSet: "$material" },
                        colors: { $addToSet: "$variants.color.name" }, // Collect unique color names
                        sizes: { $addToSet: "$variants.variantSizes.size" } // Collect unique sizes
                    }
                }
            ]);

            if (filters.length === 0) {
                throw new Error("No data found for this group.");
            }

            // Format response
            const result = {
                group: groupName,
                category: filters[0].category,
                subCategory: filters[0].subCategory,
                gender: filters[0].gender,
                productType: filters[0].productType,
                fit: filters[0].fit,
                neckline: filters[0].neckline,
                pattern: filters[0].pattern,
                cuff: filters[0].cuff,
                sleeves: filters[0].sleeves,
                material: filters[0].material,
                colors: filters[0].colors, // Add colors to the output
                sizes: filters[0].sizes // Add sizes to the output
            };

            return result;
        } catch (error) {
            // Log and return error
            console.error(`Error fetching filters for group ${groupName}:`, error);
            return { error: error.message || "An unexpected error occurred while fetching filters." };
        }
    }

    async getFits(groupName, category, subCategory, gender, productType) {
        let modelToUse; // Define a variable to hold the model to use

        switch (groupName) {
            case "HEAL":
                modelToUse = HealModel;
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
                modelToUse = HealModel;
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
                modelToUse = HealModel;
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
                modelToUse = HealModel;
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
                modelToUse = HealModel;
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

        const colorMap = {
            "BLACK": "#000000",
            "SAGE GREEN": "#B2AC88",
            "CHERRY LACQUER": "#532D3A",
            "ELECTRIC INDIGO": "#6f00ff",
            "MAUVE": "#E0B0FF",
            "CELESTIAL YELLOW": "#FFE6A2",
            "DUSTED GRAPE": "#ab92b3",
            "SEPIA MIDNIGHT PLUM": "#553842",
            "TERRACOTTA": "#E2725B",
            "DIGITAL MIST": "#646D7E",
            "OLIVE GREEN": "#BAB86C",
            "CAMOUFLAGE": "#78866b",
            "NAVY BLUE": "#000080",
            "SKY BLUE": "#87CEEB",
            "WHITE": "#ffffff",
            "INDIGO": "#4B0082",
            "GREEN": "#00FF00",
            "GRAY": "#808080",
            "GREY": "#808080",
            "RED": "#ff0000",
            "MAROON": "#800000"
        };

        const sizeAndColorConfig = {
            "ELITE": {
                allColors: ["WHITE", "BLACK", "INDIGO", "SKY BLUE", "NAVY BLUE", "GREEN", "GREY", "MAROON", "RED"],
                allSizes: ["S", "M", "L", "XL", "XXL"]
            },
            "HEAL": {
                allColors: ["BLACK", "SAGE GREEN", "CHERRY LACQUER", "ELECTRIC INDIGO", "MAUVE", "CELESTIAL YELLOW", "DUSTED GRAPE", "SEPIA MIDNIGHT PLUM", "TERRACOTTA", "DIGITAL MIST", "COATS COLOR"],
                allSizes: ["XS", "S", "M", "L", "XL", "XXL"]
            },
            "SHIELD": {
                allColors: ["OLIVE GREEN", "CAMOUFLAGE", "NAVY BLUE", "SKY BLUE", "BLACK", "WHITE"],
                allSizes: ["S", "M", "L", "XL", "XXL"]
            },
            "TOGS": {
                allColors: [],
                allSizes: ["22", "24", "26", "28", "30", "32", "34", "36", "38", "40", "42", "44"]
            },
            "SPIRIT": {
                allColors: [],
                allSizes: ["XS", "S", "M", "L", "XL", "XXL"]
            },
            "WORK WEAR UNIFORMS": {
                allColors: [],
                allSizes: ["S", "M", "L", "XL", "XXL"]
            }
        };

        const modelToUse = modelMap[groupName];

        // Building the query dynamically based on provided parameters
        const matchQuery = {
            "category.name": category,
            "subCategory.name": subCategory
        };

        // Add parameters if they are provided and are not empty
        if (gender) matchQuery.gender = gender;
        if (productType) matchQuery["productType.type"] = productType;
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
                        fabric: 1,
                        price: 1,
                        productDetails: 1,
                        variants: {
                            $filter: {
                                input: "$variants",
                                as: "variant",
                                cond: {
                                    $and: [
                                        color ? { $eq: ["$$variant.color.name", color] } : {},
                                        size ? { $in: [size, "$$variant.variantSizes.size"] } : {}
                                    ]
                                }
                            }
                        },
                        allVariants: "$variants",
                        allSizes: sizeAndColorConfig[groupName].allSizes,
                        allColors: sizeAndColorConfig[groupName].allColors.map(colorName => ({
                            name: colorName,
                            hexcode: colorMap[colorName.toUpperCase()]
                        }))
                    }
                }
            ]);

            // Collect all other colors with their sizes and quantities
            const others = products.map(product => {
                const colorsWithSizesAndQuantities = {};
                product.allVariants.forEach(variant => {
                    if (!variant.isDeleted) {
                        const colorName = variant.color.name;
                        if (!colorsWithSizesAndQuantities[colorName]) {
                            colorsWithSizesAndQuantities[colorName] = {
                                color: variant.color,
                                sizesAndQty: []
                            };
                        }
                        variant.variantSizes.forEach(sizeEntry => {
                            colorsWithSizesAndQuantities[colorName].sizesAndQty.push({
                                size: sizeEntry.size,
                                quantity: sizeEntry.quantity
                            });
                        });
                    }
                });

                return Object.values(colorsWithSizesAndQuantities); // Return the structured color objects with sizes and quantities
            });

            return products.map((product, index) => {
                // Remove the 'allVariants' key from each product
                delete product.allVariants;

                // Add 'available' data for the product from the 'others' array using the same index
                product.available = others[index];

                // Return the modified product
                return product;
            });

        } catch (error) {
            console.error("Failed to fetch products:", error);
            return [];
        }
    }

    async getAllSchoolNames() {
        try {
            const schoolNames = await mongoose.model("Togs").aggregate([
                {
                    $match: {
                        isDeleted: false, // Optional: Only include non-deleted records
                    },
                },
                {
                    $group: {
                        _id: null,
                        uniqueSchoolNames: { $addToSet: "$schoolName" },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        uniqueSchoolNames: 1,
                    },
                },
            ]);

            return schoolNames.length > 0 ? schoolNames[0].uniqueSchoolNames : [];
        } catch (error) {
            console.error("Error fetching school names: ", error);
            return [];
        }
    };

    async getProductsByGroup(groupName, color, size) {
        const sizeAndColorConfig = {
            "ELITE": {
                allColors: [],
                allSizes: ["XS", "S", "M", "L", "XL", "XXL"]
            },
            "HEAL": {
                allColors: [],
                allSizes: ["XS", "S", "M", "L", "XL", "XXL"]
            },
            "TOGS": {
                allColors: [],
                allSizes: ["22", "24", "26", "28", "30", "32", "34", "36", "38", "40", "42", "44"]
            }
        };

        const modelToUse = modelMap[groupName];
        const allProducts = [];
        try {
            // Use the aggregation pipeline to ensure unique category data
            const result = await modelToUse.aggregate([
                { $match: { isDeleted: false } }, // Filter out deleted items
                {
                    $group: { // Group by category name and imageUrl to ensure uniqueness
                        _id: { name: "$category" },//, imageUrl: "$category.imageUrl" 
                        category: { $first: "$category" },
                    }
                },
                {
                    $project: { // Project the necessary fields
                        _id: 0,
                        category: "$category"
                    }
                }
            ]);

            const categories = result.map(item => item.category);
            // Iterate over categories to fetch unique subCategories
            for (const category of categories) {
                const subCategoriesResult = await modelToUse.aggregate([
                    { $match: { 'category': category } }, // Match documents by category name
                    {
                        $group: { // Group by subCategory name and imageUrl to ensure uniqueness
                            _id: { name: "$subCategory" },
                            subCategory: { $first: "$subCategory" },
                        }
                    },
                    {
                        $project: { // Project the necessary fields
                            _id: 0,
                            subCategory: "$subCategory"
                        }
                    }
                ]);
                const subCategories = subCategoriesResult.map(item => item.subCategory);
                for (const subCategory of subCategories) {
                    const matchQuery = {
                        category: category,
                        subCategory: subCategory,
                    };
                    const products = await modelToUse.aggregate([
                        { $match: matchQuery },
                        {
                            $project: {
                                _id: 1,
                                productId: 1,
                                group: 1,
                                category: 1,
                                subCategory: 1,
                                gender: 1,
                                productType: 1,
                                fit: 1,
                                neckline: 1,
                                pattern: 1,
                                cuff: 1,
                                sleeves: 1,
                                material: 1,
                                fabric: 1,
                                price: 1,
                                productDescription: 1,
                                variants: {
                                    $filter: {
                                        input: "$variants",
                                        as: "variant",
                                        cond: {
                                            $and: [
                                                color ? { $eq: ["$$variant.color.name", color] } : {},
                                                size ? { $in: [size, "$$variant.variantSizes.size"] } : {}
                                            ]
                                        }
                                    }
                                },
                                allVariants: "$variants",
                                allSizes: sizeAndColorConfig[groupName].allSizes
                            }
                        }
                    ]);

                    // Collect all other colors with their sizes and quantities
                    const others = products.map(product => {
                        const colorsWithSizesAndQuantities = {};
                        product.allVariants.forEach(variant => {
                            if (!variant.isDeleted) {
                                const colorName = variant.color.name;
                                let sizesAndQty = []; // Temporary array to hold valid sizes

                                // Only add sizes with quantity more than 0
                                variant.variantSizes.forEach(sizeEntry => {
                                    if (sizeEntry.quantity > 0) {
                                        sizesAndQty.push({
                                            size: sizeEntry.size,
                                            quantity: sizeEntry.quantity
                                        });
                                    }
                                });

                                // Only add the color if there are sizes with quantities more than 0
                                if (sizesAndQty.length > 0) {
                                    colorsWithSizesAndQuantities[colorName] = {
                                        color: variant.color,
                                        sizesAndQty: sizesAndQty
                                    };
                                }
                            }
                        });

                        return Object.values(colorsWithSizesAndQuantities); // Return the structured color objects with sizes and quantities
                    });

                    const allColors = products.reduce((acc, product) => {
                        product.allVariants.forEach(variant => {
                            if (!variant.isDeleted) {
                                const colorName = variant.color.name;
                                const hexcode = variant.color.hexcode;

                                // Check if the color has already been added to avoid duplicates
                                if (!acc.some(color => color.name === colorName)) {
                                    acc.push({
                                        name: colorName,
                                        hexcode: hexcode
                                    });
                                }
                            }
                        });
                        return acc;
                    }, []);

                    products.forEach((product, index) => {
                        // Remove the 'allVariants' key from each product
                        delete product.allVariants;

                        product.allColors = allColors;

                        // Add 'available' data for the product from the 'others' array using the same index
                        product.available = others[index];
                        // Return the modified product
                        allProducts.push(product);
                    });
                }
            }
            return allProducts
        } catch (error) {
            console.error('Error fetching products:', error);
            // Handle errors appropriately, potentially rethrowing or returning an error response
            throw new Error('Failed to fetch products by filters.');
        }
    }

    async getProductsByGroupAndSchoolName(groupName, schoolName, color, size) {
        const sizeAndColorConfig = {
            "ELITE": {
                allColors: [],
                allSizes: ["XS", "S", "M", "L", "XL", "XXL"]
            },
            "HEAL": {
                allColors: [],
                allSizes: ["XS", "S", "M", "L", "XL", "XXL"]
            },
            "TOGS": {
                allColors: [],
                allSizes: ["22", "24", "26", "28", "30", "32", "34", "36", "38", "40", "42", "44"]
            }
        };

        const modelToUse = modelMap[groupName];
        const allProducts = [];
        try {
            // Use the aggregation pipeline to ensure unique category data
            const result = await modelToUse.aggregate([
                { $match: { isDeleted: false } }, // Filter by schoolName and non-deleted items
                {
                    $group: { // Group by category name and imageUrl to ensure uniqueness
                        _id: { name: "$category" },
                        category: { $first: "$category" },
                    }
                },
                {
                    $project: { // Project the necessary fields
                        _id: 0,
                        category: "$category"
                    }
                }
            ]);


            const categories = result.map(item => item.category);
            // Iterate over categories to fetch unique subCategories
            for (const category of categories) {
                const subCategoriesResult = await modelToUse.aggregate([
                    { $match: { 'category': category } }, // Match documents by category and schoolName
                    {
                        $group: { // Group by subCategory name and imageUrl to ensure uniqueness
                            _id: { name: "$subCategory" },
                            subCategory: { $first: "$subCategory" },
                        }
                    },
                    {
                        $project: { // Project the necessary fields
                            _id: 0,
                            subCategory: "$subCategory"
                        }
                    }
                ]);


                const subCategories = subCategoriesResult.map(item => item.subCategory);
                for (const subCategory of subCategories) {
                    const matchQuery = {
                        category: category,
                        subCategory: subCategory,
                        schoolName: schoolName // Include schoolName in the query
                    };
                    const products = await modelToUse.aggregate([
                        { $match: matchQuery },
                        {
                            $project: {
                                _id: 1,
                                productId: 1,
                                group: 1,
                                category: 1,
                                subCategory: 1,
                                schoolName: 1, // Include schoolName in the product data
                                gender: 1,
                                productType: 1,
                                fit: 1,
                                neckline: 1,
                                pattern: 1,
                                cuff: 1,
                                sleeves: 1,
                                material: 1,
                                fabric: 1,
                                price: 1,
                                productDescription: 1,
                                variants: {
                                    $filter: {
                                        input: "$variants",
                                        as: "variant",
                                        cond: {
                                            $and: [
                                                color ? { $eq: ["$$variant.color.name", color] } : {},
                                                size ? { $in: [size, "$$variant.variantSizes.size"] } : {}
                                            ]
                                        }
                                    }
                                },
                                allVariants: "$variants",
                                allSizes: sizeAndColorConfig[groupName].allSizes
                            }
                        }
                    ]);

    
                    // Collect all other colors with their sizes and quantities
                    const others = products.map(product => {
                        const colorsWithSizesAndQuantities = {};
                        product.allVariants.forEach(variant => {
                            if (!variant.isDeleted) {
                                const colorName = variant.color.name;
                                let sizesAndQty = []; // Temporary array to hold valid sizes

                                // Only add sizes with quantity more than 0
                                variant.variantSizes.forEach(sizeEntry => {
                                    if (sizeEntry.quantity > 0) {
                                        sizesAndQty.push({
                                            size: sizeEntry.size,
                                            quantity: sizeEntry.quantity
                                        });
                                    }
                                });

                                // Only add the color if there are sizes with quantities more than 0
                                if (sizesAndQty.length > 0) {
                                    colorsWithSizesAndQuantities[colorName] = {
                                        color: variant.color,
                                        sizesAndQty: sizesAndQty
                                    };
                                }
                            }
                        });

                        return Object.values(colorsWithSizesAndQuantities); // Return the structured color objects with sizes and quantities
                    });

                    const allColors = products.reduce((acc, product) => {
                        product.allVariants.forEach(variant => {
                            if (!variant.isDeleted) {
                                const colorName = variant.color.name;
                                const hexcode = variant.color.hexcode;

                                // Check if the color has already been added to avoid duplicates
                                if (!acc.some(color => color.name === colorName)) {
                                    acc.push({
                                        name: colorName,
                                        hexcode: hexcode
                                    });
                                }
                            }
                        });
                        return acc;
                    }, []);

                    products.forEach((product, index) => {
                        // Remove the 'allVariants' key from each product
                        delete product.allVariants;

                        product.allColors = allColors;

                        // Add 'available' data for the product from the 'others' array using the same index
                        product.available = others[index];
                        // Return the modified product
                        allProducts.push(product);
                    });
                }
            }
            return allProducts;
        } catch (error) {
            console.error('Error fetching products:', error);
            // Handle errors appropriately, potentially rethrowing or returning an error response
            throw new Error('Failed to fetch products by filters.');
        }
    }



    async getProductVariantAvaColors(groupName, productId) {

        const modelToUse = modelMap[groupName];

        if (!modelToUse) {
            console.error("Invalid groupName provided");
            return { colors: [] };//, sizes: []
        }

        try {
            const product = await modelToUse.findOne({ productId }).lean();

            if (!product) {
                console.log("Product not found");
                return { AvaColors: [] };//, sizes: []
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
                AvaColors: Array.from(colors)
            };
        } catch (error) {
            console.error("Failed to fetch product details:", error);
            return { sizes: [], colors: [] };
        }
    }

    async getAvaSizesByColor(groupName, productId, color) {
        const modelToUse = modelMap[groupName];

        if (!modelToUse) {
            console.error("Invalid groupName provided");
            return { sizes: [], message: "Invalid groupName or model not found." };
        }

        try {
            const product = await modelToUse.findOne({ "productId": productId }).lean();

            if (!product) {
                console.log("Product not found");
                return { sizes: [], message: "Product not found." };
            }

            const sizesWithQuantities = {};

            product.variants.forEach(variant => {
                if (variant.color.name === color && !variant.isDeleted) {
                    variant.variantSizes.forEach(sizeEntry => {
                        if (sizeEntry.quantity > 0) {  // Ensure only sizes with available quantity are added
                            sizesWithQuantities[sizeEntry.size] = sizeEntry.quantity;
                        }
                    });
                }
            });

            const sizeKeys = Object.keys(sizesWithQuantities);
            return {
                avaSizesAndQty: sizeKeys.length > 0 ? sizeKeys.map(size => ({ size, quantity: sizesWithQuantities[size] })) : [],
                message: sizeKeys.length > 0 ? "Sizes retrieved successfully." : "No sizes found for the specified color."
            };
        } catch (error) {
            console.error("Failed to fetch product details:", error);
            return { sizes: [], message: "Failed to fetch product details." };
        }
    }



    async getProductDetailsWithSpecificVariant(groupName, productId, size, color) {

        const sizeAndColorConfig = {
            "ELITE": {
                allColors: [],
                allSizes: ["S", "M", "L", "XL", "XXL"]
            },
            "HEAL": {
                allColors: [],
                allSizes: ["XS", "S", "M", "L", "XL", "XXL"]
            },
            "SHIELD": {
                allColors: [],
                allSizes: ["S", "M", "L", "XL", "XXL"]
            },
            "TOGS": {
                allColors: [],
                allSizes: ["22", "24", "26", "28", "30", "32", "34", "36", "38", "40", "42", "44"]
            },
            "SPIRIT": {
                allColors: [],
                allSizes: ["XS", "S", "M", "L", "XL", "XXL"]
            },
            "WORK WEAR UNIFORMS": {
                allColors: [],
                allSizes: ["S", "M", "L", "XL", "XXL"]
            }
        };

        const modelToUse = modelMap[groupName];

        if (!modelToUse) {
            console.error("Invalid groupName provided");
            return null;
        }

        try {
            const product = await modelToUse.findOne({
                productId,
                "variants.color.name": color,
                // "variants.variantSizes.size": size
            }).lean();

            if (!product) {
                console.log("Product not found");
                return null;
            }

            const colorsWithSizesAndQuantities = {};

            product.variants.forEach(variant => {
                if (!variant.isDeleted) {
                    const colorName = variant.color.name;
                    let sizesAndQty = []; // Temporary array to hold valid sizes

                    // Only add sizes with quantity more than 0
                    variant.variantSizes.forEach(sizeEntry => {
                        if (sizeEntry.quantity > 0) {
                            sizesAndQty.push({
                                size: sizeEntry.size,
                                quantity: sizeEntry.quantity
                            });
                        }
                    });

                    // Only add the color if there are sizes with quantities more than 0
                    if (sizesAndQty.length > 0) {
                        colorsWithSizesAndQuantities[colorName] = {
                            color: variant.color,
                            sizesAndQty: sizesAndQty
                        };
                    }
                }
            });

            const specificVariant = product.variants.find(variant => variant.color.name === color);

            const available = Object.values(colorsWithSizesAndQuantities);

            const currentConfig = sizeAndColorConfig[groupName];

            const allColors = product.variants.reduce((acc, variant) => {
                if (!variant.isDeleted) {
                    const colorName = variant.color.name;
                    const hexcode = variant.color.hexcode;

                    // Check if the color has already been added to avoid duplicates
                    if (!acc.some(color => color.name === colorName)) {
                        acc.push({
                            name: colorName,
                            hexcode: hexcode
                        });
                    }
                }
                return acc; // Return the accumulator for the next iteration
            }, []); // Initialize acc as an empty array


            return specificVariant ? {
                productDetails: {
                    ...product,
                    variants: [specificVariant]
                },
                allSizes: currentConfig.allSizes,
                allColors,
                available
            } : {
                message: "This product has no variants available with the given size and color combination.",
                available
            };
        } catch (error) {
            console.error("Failed to fetch product details:", error);
            return null;
        }
    }

    async getProductFilters(groupName, category, subCategory, gender, productType) {

        const modelToUse = modelMap[groupName];

        // if (!modelToUse || !category || !subCategory) {
        //     console.error("Invalid parameters provided");
        //     return { filters: {} };
        // }

        const query = {
            "category.name": category,
            "subCategory.name": subCategory
        };
        if (gender) query.gender = gender;
        if (productType) query["productType.type"] = productType;

        try {
            const results = await modelToUse.aggregate([
                { $match: query },
                {
                    $facet: {
                        fits: [{ $group: { _id: null, fits: { $addToSet: "$fit" } } }],
                        fabrics: [{ $group: { _id: null, fabrics: { $addToSet: "$fabric" } } }],
                        colors: [
                            { $unwind: "$variants" },
                            { $group: { _id: null, colors: { $addToSet: "$variants.color" } } }
                        ],
                        sizes: [
                            { $unwind: "$variants" },
                            { $unwind: "$variants.variantSizes" },
                            { $match: { "variants.variantSizes.quantity": { $gt: 5 } } },
                            { $group: { _id: null, sizes: { $addToSet: "$variants.variantSizes.size" } } }
                        ],
                        necklines: [{ $group: { _id: null, necklines: { $addToSet: "$neckline" } } }],
                        sleeves: [{ $group: { _id: null, sleeves: { $addToSet: "$sleeves" } } }],
                        cuff: [{ $group: { _id: null, cuff: { $addToSet: "$cuff" } } }],
                        pattern: [{ $group: { _id: null, pattern: { $addToSet: "$pattern" } } }],
                        material: [{ $group: { _id: null, material: { $addToSet: "$material" } } }]
                    }
                }
            ]);

            const { fits, colors, sizes, fabrics, necklines, sleeves, cuff, pattern, material } = results[0];
            if (groupName === "HEAL") {
                if (category === "COATS") {
                    return {
                        fabrics: fabrics[0]?.fabrics || [],
                        sleeves: sleeves[0]?.sleeves || [],
                        sizes: sizes[0]?.sizes || [],
                    }
                } else {
                    return {
                        fabrics: fabrics[0]?.fabrics || [],
                        colors: colors[0]?.colors || [],
                        sizes: sizes[0]?.sizes || [],
                    }
                }

            }
            else if (groupName === "WORK WEAR UNIFORMS" || groupName === "SHIELD") {
                return {
                    colors: colors[0]?.colors || [],
                    sizes: sizes[0]?.sizes || [],
                }
            } else if (groupName === "SPIRIT") {
                if (['JACKETS', 'JERSEY T-SHIRT'].includes(productType)) {
                    return {
                        filters: {
                            colors: colors[0]?.colors || [],
                            sizes: sizes[0]?.sizes || [],
                            necklines: necklines[0]?.necklines || [],
                            sleeves: sleeves[0]?.sleeves || []
                        }
                    }
                } else {
                    return {
                        colors: colors[0]?.colors || [],
                        sizes: sizes[0]?.sizes || [],
                    }
                }
            } else if (groupName === "TOGS") {
                return {
                    filters: {
                        fits: fits[0]?.fits || [],
                        colors: colors[0]?.colors || [],
                        sizes: sizes[0]?.sizes || [],
                    }
                }
            }
            else {
                return {
                    filters: {
                        fits: fits[0]?.fits || [],
                        colors: colors[0]?.colors || [],
                        sizes: sizes[0]?.sizes || [],
                        necklines: necklines[0]?.necklines || [],
                        sleeves: sleeves[0]?.sleeves || [],
                        cuff: cuff[0]?.cuff || [],
                        pattern: pattern[0]?.pattern || [],
                        material: material[0]?.material || [],
                    }
                }
            };
        } catch (error) {
            console.error("Failed to fetch products:", error);
            return { filters: {} };
        }
    }

    async getProductFilters(groupName) {
        const modelToUse = modelMap[groupName];

        const query = {
            "category.name": category,
            "subCategory.name": subCategory
        };
        if (gender) query.gender = gender;
        if (productType) query["productType.type"] = productType;

        try {
            const results = await modelToUse.aggregate([
                { $match: query },
                {
                    $facet: {
                        fits: [{ $group: { _id: null, fits: { $addToSet: "$fit" } } }],
                        fabrics: [{ $group: { _id: null, fabrics: { $addToSet: "$fabric" } } }],
                        colors: [
                            { $unwind: "$variants" },
                            { $group: { _id: null, colors: { $addToSet: "$variants.color" } } }
                        ],
                        sizes: [
                            { $unwind: "$variants" },
                            { $unwind: "$variants.variantSizes" },
                            { $match: { "variants.variantSizes.quantity": { $gt: 5 } } },
                            { $group: { _id: null, sizes: { $addToSet: "$variants.variantSizes.size" } } }
                        ],
                        necklines: [{ $group: { _id: null, necklines: { $addToSet: "$neckline" } } }],
                        sleeves: [{ $group: { _id: null, sleeves: { $addToSet: "$sleeves" } } }],
                        cuff: [{ $group: { _id: null, cuff: { $addToSet: "$cuff" } } }],
                        pattern: [{ $group: { _id: null, pattern: { $addToSet: "$pattern" } } }],
                        material: [{ $group: { _id: null, material: { $addToSet: "$material" } } }]
                    }
                }
            ]);

            const { fits, colors, sizes, fabrics, necklines, sleeves, cuff, pattern, material } = results[0];
            if (groupName === "HEAL") {
                if (category === "COATS") {
                    return {
                        fabrics: fabrics[0]?.fabrics || [],
                        sleeves: sleeves[0]?.sleeves || [],
                        sizes: sizes[0]?.sizes || [],
                    }
                } else {
                    return {
                        fabrics: fabrics[0]?.fabrics || [],
                        colors: colors[0]?.colors || [],
                        sizes: sizes[0]?.sizes || [],
                    }
                }

            }
            else if (groupName === "WORK WEAR UNIFORMS" || groupName === "SHIELD") {
                return {
                    colors: colors[0]?.colors || [],
                    sizes: sizes[0]?.sizes || [],
                }
            } else if (groupName === "SPIRIT") {
                if (['JACKETS', 'JERSEY T-SHIRT'].includes(productType)) {
                    return {
                        filters: {
                            colors: colors[0]?.colors || [],
                            sizes: sizes[0]?.sizes || [],
                            necklines: necklines[0]?.necklines || [],
                            sleeves: sleeves[0]?.sleeves || []
                        }
                    }
                } else {
                    return {
                        colors: colors[0]?.colors || [],
                        sizes: sizes[0]?.sizes || [],
                    }
                }
            } else if (groupName === "TOGS") {
                return {
                    filters: {
                        fits: fits[0]?.fits || [],
                        colors: colors[0]?.colors || [],
                        sizes: sizes[0]?.sizes || [],
                    }
                }
            }
            else {
                return {
                    filters: {
                        fits: fits[0]?.fits || [],
                        colors: colors[0]?.colors || [],
                        sizes: sizes[0]?.sizes || [],
                        necklines: necklines[0]?.necklines || [],
                        sleeves: sleeves[0]?.sleeves || [],
                        cuff: cuff[0]?.cuff || [],
                        pattern: pattern[0]?.pattern || [],
                        material: material[0]?.material || [],
                    }
                }
            };
        } catch (error) {
            console.error("Failed to fetch products:", error);
            return { filters: {} };
        }
    }

    async getFits(groupName, category, subCategory, gender, productType) {
        let modelToUse; // Define a variable to hold the model to use

        switch (groupName) {
            case "HEAL":
                modelToUse = HealModel;
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
                modelToUse = HealModel;
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
                modelToUse = HealModel;
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
                modelToUse = HealModel;
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
                modelToUse = HealModel;
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
        const colorMap = {
            "BLACK": "#000000",
            "SAGE GREEN": "#B2AC88",
            "CHERRY LACQUER": "#532D3A",
            "ELECTRIC INDIGO": "#6f00ff",
            "MAUVE": "#E0B0FF",
            "CELESTIAL YELLOW": "#FFE6A2",
            "DUSTED GRAPE": "#ab92b3",
            "SEPIA MIDNIGHT PLUM": "#553842",
            "TERRACOTTA": "#E2725B",
            "DIGITAL MIST": "#646D7E",
            "OLIVE GREEN": "#BAB86C",
            "CAMOUFLAGE": "#78866b",
            "NAVY BLUE": "#000080",
            "SKY BLUE": "#87CEEB",
            "WHITE": "#ffffff",
            "INDIGO": "#4B0082",
            "GREEN": "#00FF00",
            "GRAY": "#808080",
            "GREY": "#808080",
            "RED": "#ff0000",
            "MAROON": "#800000"
        };

        const sizeAndColorConfig = {
            "ELITE": {
                allColors: ["WHITE", "BLACK", "INDIGO", "SKY BLUE", "NAVY BLUE", "GREEN", "GREY", "MAROON", "RED"],
                allSizes: ["S", "M", "L", "XL", "XXL"]
            },
            "HEAL": {
                allColors: ["BLACK", "SAGE GREEN", "CHERRY LACQUER", "ELECTRIC INDIGO", "MAUVE", "CELESTIAL YELLOW", "DUSTED GRAPE", "SEPIA MIDNIGHT PLUM", "TERRACOTTA", "DIGITAL MIST", "COATS COLOR"],
                allSizes: ["XS", "S", "M", "L", "XL", "XXL"]
            },
            "SHIELD": {
                allColors: ["OLIVE GREEN", "CAMOUFLAGE", "NAVY BLUE", "SKY BLUE", "BLACK", "WHITE"],
                allSizes: ["S", "M", "L", "XL", "XXL"]
            },
            "TOGS": {
                allColors: [],
                allSizes: ["22", "24", "26", "28", "30", "32", "34", "36", "38", "40", "42", "44"]
            },
            "SPIRIT": {
                allColors: [],
                allSizes: ["XS", "S", "M", "L", "XL", "XXL"]
            },
            "WORK WEAR UNIFORMS": {
                allColors: [],
                allSizes: ["S", "M", "L", "XL", "XXL"]
            }
        };

        const modelToUse = modelMap[groupName];

        // Building the query dynamically based on provided parameters
        const matchQuery = {
            "category.name": category,
            "subCategory.name": subCategory
        };

        // Add parameters if they are provided and are not empty
        if (gender) matchQuery.gender = gender;
        if (productType) matchQuery["productType.type"] = productType;
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
                        fabric: 1,
                        price: 1,
                        productDetails: 1,
                        variants: {
                            $filter: {
                                input: "$variants",
                                as: "variant",
                                cond: {
                                    $and: [
                                        color ? { $eq: ["$$variant.color.name", color] } : {},
                                        size ? { $in: [size, "$$variant.variantSizes.size"] } : {}
                                    ]
                                }
                            }
                        },
                        allVariants: "$variants",
                        allSizes: sizeAndColorConfig[groupName].allSizes,
                        allColors: sizeAndColorConfig[groupName].allColors.map(colorName => ({
                            name: colorName,
                            hexcode: colorMap[colorName.toUpperCase()]
                        }))
                    }
                }
            ]);

            // Collect all other colors with their sizes and quantities
            const others = products.map(product => {
                const colorsWithSizesAndQuantities = {};
                product.allVariants.forEach(variant => {
                    if (!variant.isDeleted) {
                        const colorName = variant.color.name;
                        if (!colorsWithSizesAndQuantities[colorName]) {
                            colorsWithSizesAndQuantities[colorName] = {
                                color: variant.color,
                                sizesAndQty: []
                            };
                        }
                        variant.variantSizes.forEach(sizeEntry => {
                            colorsWithSizesAndQuantities[colorName].sizesAndQty.push({
                                size: sizeEntry.size,
                                quantity: sizeEntry.quantity
                            });
                        });
                    }
                });

                return Object.values(colorsWithSizesAndQuantities); // Return the structured color objects with sizes and quantities
            });

            return products.map((product, index) => {
                // Remove the 'allVariants' key from each product
                delete product.allVariants;

                // Add 'available' data for the product from the 'others' array using the same index
                product.available = others[index];

                // Return the modified product
                return product;
            });

        } catch (error) {
            console.error("Failed to fetch products:", error);
            return [];
        }
    }

    async getProductVariantAvaColors(groupName, productId) {

        const modelToUse = modelMap[groupName];

        if (!modelToUse) {
            console.error("Invalid groupName provided");
            return { colors: [] };//, sizes: []
        }

        try {
            const product = await modelToUse.findOne({ productId }).lean();

            if (!product) {
                console.log("Product not found");
                return { AvaColors: [] };//, sizes: []
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
                AvaColors: Array.from(colors)
            };
        } catch (error) {
            console.error("Failed to fetch product details:", error);
            return { sizes: [], colors: [] };
        }
    }

    async getAvaSizesByColor(groupName, productId, color) {
        const modelToUse = modelMap[groupName];

        if (!modelToUse) {
            console.error("Invalid groupName provided");
            return { sizes: [], message: "Invalid groupName or model not found." };
        }

        try {
            const product = await modelToUse.findOne({ "productId": productId }).lean();

            if (!product) {
                console.log("Product not found");
                return { sizes: [], message: "Product not found." };
            }

            const sizesWithQuantities = {};

            product.variants.forEach(variant => {
                if (variant.color.name === color && !variant.isDeleted) {
                    variant.variantSizes.forEach(sizeEntry => {
                        if (sizeEntry.quantity > 0) {  // Ensure only sizes with available quantity are added
                            sizesWithQuantities[sizeEntry.size] = sizeEntry.quantity;
                        }
                    });
                }
            });

            const sizeKeys = Object.keys(sizesWithQuantities);
            return {
                avaSizesAndQty: sizeKeys.length > 0 ? sizeKeys.map(size => ({ size, quantity: sizesWithQuantities[size] })) : [],
                message: sizeKeys.length > 0 ? "Sizes retrieved successfully." : "No sizes found for the specified color."
            };
        } catch (error) {
            console.error("Failed to fetch product details:", error);
            return { sizes: [], message: "Failed to fetch product details." };
        }
    }



    async getProductDetailsWithSpecificVariant(groupName, productId, size, color) {

        const sizeAndColorConfig = {
            "ELITE": {
                allColors: [],
                allSizes: ["S", "M", "L", "XL", "XXL"]
            },
            "HEAL": {
                allColors: [],
                allSizes: ["XS", "S", "M", "L", "XL", "XXL"]
            },
            "SHIELD": {
                allColors: [],
                allSizes: ["S", "M", "L", "XL", "XXL"]
            },
            "TOGS": {
                allColors: [],
                allSizes: ["22", "24", "26", "28", "30", "32", "34", "36", "38", "40", "42", "44"]
            },
            "SPIRIT": {
                allColors: [],
                allSizes: ["XS", "S", "M", "L", "XL", "XXL"]
            },
            "WORK WEAR UNIFORMS": {
                allColors: [],
                allSizes: ["S", "M", "L", "XL", "XXL"]
            }
        };

        const modelToUse = modelMap[groupName];

        if (!modelToUse) {
            console.error("Invalid groupName provided");
            return null;
        }

        try {
            const product = await modelToUse.findOne({
                productId,
                "variants.color.name": color,
                // "variants.variantSizes.size": size
            }).lean();

            if (!product) {
                console.log("Product not found");
                return null;
            }

            const colorsWithSizesAndQuantities = {};

            product.variants.forEach(variant => {
                if (!variant.isDeleted) {
                    const colorName = variant.color.name;
                    let sizesAndQty = []; // Temporary array to hold valid sizes

                    // Only add sizes with quantity more than 0
                    variant.variantSizes.forEach(sizeEntry => {
                        if (sizeEntry.quantity > 0) {
                            sizesAndQty.push({
                                size: sizeEntry.size,
                                quantity: sizeEntry.quantity
                            });
                        }
                    });

                    // Only add the color if there are sizes with quantities more than 0
                    if (sizesAndQty.length > 0) {
                        colorsWithSizesAndQuantities[colorName] = {
                            color: variant.color,
                            sizesAndQty: sizesAndQty
                        };
                    }
                }
            });

            const specificVariant = product.variants.find(variant => variant.color.name === color);

            const available = Object.values(colorsWithSizesAndQuantities);

            const currentConfig = sizeAndColorConfig[groupName];

            const allColors = product.variants.reduce((acc, variant) => {
                if (!variant.isDeleted) {
                    const colorName = variant.color.name;
                    const hexcode = variant.color.hexcode;

                    // Check if the color has already been added to avoid duplicates
                    if (!acc.some(color => color.name === colorName)) {
                        acc.push({
                            name: colorName,
                            hexcode: hexcode
                        });
                    }
                }
                return acc; // Return the accumulator for the next iteration
            }, []); // Initialize acc as an empty array


            return specificVariant ? {
                productDetails: {
                    ...product,
                    variants: [specificVariant]
                },
                allSizes: currentConfig.allSizes,
                allColors,
                available
            } : {
                message: "This product has no variants available with the given size and color combination.",
                available
            };
        } catch (error) {
            console.error("Failed to fetch product details:", error);
            return null;
        }
    }



}
module.exports = EComService;