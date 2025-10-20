// AdminProductUploader.jsx

import React, { useState, useCallback } from 'react';
import { RefreshCw, Zap, Package, X, Plus } from 'lucide-react';

// IMPORTANT: REPLACE with your actual Render API URL
const API_BASE_URL = 'https://siraj-backend.onrender.com'; 

// 1. Initial State Definitions (Adjusted to reflect Mongoose Schema Keys)
const initialBundleItem = {
    subProductName: 'Item', // FIXED: Mongoose key is 'subProductName', not 'name'
    size: '',
    allowedScents: ['Vanilla Cookie'], // Stored as Array in state, will be String for Mongoose
};

const initialProductState = {
    productType: 'Single', // Mongoose: productType
    category: '',         // Mongoose: category
    price_egp: 0,         // Mongoose: price_egp
    stock: 0,             // FIXED: Mongoose key is 'stock', not 'stockQuantity'
    status: 'Active',     // Mongoose: status
    featured: false,     // Mongoose: featured (Add this missing key for completeness)
    
    // Single Product Fields
    name_en: '',          // Mongoose: name_en
    description_en: '',   // Mongoose: description_en
    scents: [],           // Mongoose: scents (will be stringified)
    size: '',             // Mongoose: size
    formattedDescription: '', // Mongoose: formattedDescription
    burnTime: '',         // Mongoose: burnTime
    wickType: '',         // Mongoose: wickType
    coverageSpace: '',    // Mongoose: coverageSpace

    // Bundle-specific state
    bundleName: '', // NEW: Added this missing key for bundle products
    bundleDescription: '', // NEW: Added this missing key for bundle products
    bundleItems: [
        { ...initialBundleItem, subProductName: 'Big Jar Candle 1' },
        { ...initialBundleItem, subProductName: 'Big Jar Candle 2' },
        { ...initialBundleItem, subProductName: 'Wax Freshener' },
    ],
    
    // For image uploads
    selectedFiles: [],
};

const AdminProductUploader = () => {
    const [formData, setFormData] = useState(initialProductState);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    // --- Handlers for Main Product Fields ---

    const handleChange = useCallback((e) => {
        const { name, value, type, checked } = e.target;
        // Handle the state key name change for stock
        const key = name === 'stockQuantity' ? 'stock' : name; 

        setFormData(prev => ({
            ...prev,
            [key]: type === 'checkbox' ? checked : value,
        }));
    }, []);

    const handlePriceChange = useCallback((e) => {
        const value = parseFloat(e.target.value) || 0;
        setFormData(prev => ({ ...prev, price_egp: value }));
    }, []);

    const handleStockChange = useCallback((e) => {
        const value = parseInt(e.target.value, 10) || 0;
        // FIXED: Update the state key to 'stock'
        setFormData(prev => ({ ...prev, stock: value })); 
    }, []);

    const handleScentsChange = useCallback((e) => {
        // Scents is stored as an array of strings in the frontend state
        const scentsArray = e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
        setFormData(prev => ({ ...prev, scents: scentsArray }));
    }, []);


    // --- Handlers for Image Uploads ---

    const handleFileChange = useCallback((e) => {
        const files = Array.from(e.target.files);
        setFormData(prev => ({ ...prev, selectedFiles: files.slice(0, 5) }));
    }, []);

    const removeFile = useCallback((index) => {
        setFormData(prev => ({ 
            ...prev, 
            selectedFiles: prev.selectedFiles.filter((_, i) => i !== index),
        }));
    }, []);

    // --- Handlers for Bundle Items ---

    const handleBundleItemChange = useCallback((index, field, value) => {
        setFormData(prev => {
            const newBundleItems = [...prev.bundleItems];
            // FIXED: map 'name' to 'subProductName' for state management
            const key = field === 'name' ? 'subProductName' : field; 
            newBundleItems[index][key] = value;
            return { ...prev, bundleItems: newBundleItems };
        });
    }, []);

    const handleBundleScentsChange = useCallback((index, value) => {
        // Scents is stored as an array of strings in the state object
        const scentsArray = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
        setFormData(prev => {
            const newBundleItems = [...prev.bundleItems];
            newBundleItems[index].allowedScents = scentsArray;
            return { ...prev, bundleItems: newBundleItems };
        });
    }, []);

    const addBundleItem = useCallback(() => {
        if (formData.bundleItems.length < 10) {
            setFormData(prev => ({
                ...prev,
                bundleItems: [...prev.bundleItems, { 
                    ...initialBundleItem, 
                    subProductName: `Item ${prev.bundleItems.length + 1}` // FIXED key
                }],
            }));
        }
    }, [formData.bundleItems.length]);

    const removeBundleItem = useCallback((index) => {
        setFormData(prev => ({
            ...prev,
            bundleItems: prev.bundleItems.filter((_, i) => i !== index),
        }));
    }, []);

    // --- Submission Logic (CRITICAL FIXES HERE) ---

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage('');

        // 1. Basic Image Validation
        if (formData.selectedFiles.length === 0) {
            setMessage('Error: Please upload at least one image.');
            setIsSubmitting(false);
            return;
        }

        // 2. Prepare the data to exactly match the Mongoose Schema
        let productDetails = {
            productType: formData.productType,
            category: formData.category,
            price_egp: formData.price_egp,
            stock: formData.stock, // FIXED: Correct key name
            status: formData.status,
            featured: formData.featured, // Correct key name
            
            // Single Product Fields (Mongoose expects a single comma-separated string for scents)
            name_en: formData.name_en,
            description_en: formData.description_en,
            formattedDescription: formData.formattedDescription,
            size: formData.size,
            burnTime: formData.burnTime,
            wickType: formData.wickType,
            coverageSpace: formData.coverageSpace,

            // CRITICAL FIX: Convert the 'scents' array back to a comma-separated string for Mongoose.
            scents: formData.scents.join(', '), 
            
            // Bundle Fields
            bundleName: formData.bundleName, // NEW
            bundleDescription: formData.bundleDescription, // NEW
            // CRITICAL FIX: Map bundle item fields to the Mongoose schema: 
            // - Convert allowedScents array to a comma-separated string.
            // - Ensure keys match (subProductName, size, allowedScents).
            bundleItems: formData.bundleItems.map(item => ({
                subProductName: item.subProductName,
                size: item.size,
                allowedScents: item.allowedScents.join(', ') // CRITICAL FIX
            }))
        };
        
        // 3. Optional Cleanup: Filter out irrelevant keys based on product type
        if (productDetails.productType === 'Single') {
            delete productDetails.bundleName;
            delete productDetails.bundleDescription;
            delete productDetails.bundleItems;
        } else { // Product Type is 'Bundle'
            delete productDetails.name_en;
            delete productDetails.description_en;
            delete productDetails.scents;
            delete productDetails.size;
            delete productDetails.formattedDescription;
            delete productDetails.burnTime;
            delete productDetails.wickType;
            delete productDetails.coverageSpace;
        }

        // 4. Create FormData object for multipart/form-data
        const data = new FormData();
        
        // IMPORTANT: Use the key 'images' or 'productImages' based on your Multer setup.
        // I will use 'images' as a standard but check your Express route.
        // Your code uses 'productImages'. I will keep 'productImages' but if it fails,
        // change it to 'images' or whatever key your Multer config uses for the array of files.
        formData.selectedFiles.forEach(file => {
            data.append('productImages', file); // Check if this should be 'images' or 'productImages'
        });
        
        // Append the product details as a stringified JSON blob under the key 'productData'
        data.append('productData', JSON.stringify(productDetails));

        try {
            const response = await fetch(`${API_BASE_URL}/api/products`, {
                method: 'POST',
                body: data, 
            });

            const result = await response.json();

            if (response.ok) {
                setMessage(`Success! Product/Bundle "${result.name_en || result.bundleName}" created. ID: ${result._id}`);
                setFormData(initialProductState); // Reset form
                document.getElementById('file-upload').value = null;
            } else {
                setMessage(`Error creating product: ${result.message || 'Unknown API error'}`);
                console.error('API Error:', result);
            }
        } catch (error) {
            setMessage(`Network Error: Could not reach the server. Check CORS/API URL.`);
            console.error('Submission Error:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isBundle = formData.productType === 'Bundle';

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />

            <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-2xl p-6 md:p-10">
                <h1 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                    <Zap className="w-6 h-6 mr-2 text-indigo-600" />
                    Admin Product Uploader
                </h1>
                <p className="text-sm text-gray-500 mb-8">
                    Define the core properties, and for bundles, specify the customizable items. Uses Cloudinary via your Render backend for image storage.
                </p>

                {message && (
                    <div className={`p-4 mb-6 rounded-lg font-medium ${message.startsWith('Error') ? 'bg-red-100 text-red-700 border-red-300' : 'bg-green-100 text-green-700 border-green-300'}`}>
                        {message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* --- Product Type Toggle --- */}
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
                        <label className="block text-lg font-semibold text-indigo-800 mb-3">
                            <Package className="w-5 h-5 inline mr-2 align-text-bottom" />
                            Product Type
                        </label>
                        <div className="flex space-x-4">
                            <label className="flex items-center cursor-pointer bg-white p-3 rounded-xl shadow-md transition hover:shadow-lg">
                                <input
                                    type="radio"
                                    name="productType"
                                    value="Single"
                                    checked={formData.productType === 'Single'}
                                    onChange={handleChange}
                                    className="h-5 w-5 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                />
                                <span className="ml-2 font-medium text-gray-700">Single Product</span>
                            </label>
                            <label className="flex items-center cursor-pointer bg-white p-3 rounded-xl shadow-md transition hover:shadow-lg">
                                <input
                                    type="radio"
                                    name="productType"
                                    value="Bundle"
                                    checked={formData.productType === 'Bundle'}
                                    onChange={handleChange}
                                    className="h-5 w-5 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                />
                                <span className="ml-2 font-medium text-gray-700">Product Bundle</span>
                            </label>
                        </div>
                    </div>

                    {/* --- Core Product Details Section --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b pb-6">
                        <h2 className="md:col-span-2 text-xl font-bold text-gray-800 border-b pb-2 mb-4">
                            General Details
                        </h2>

                        <div className="col-span-1">
                            <label htmlFor="name_en" className="block text-sm font-medium text-gray-700">Name (English) <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="name_en"
                                id="name_en"
                                value={formData.name_en}
                                onChange={handleChange}
                                required={!isBundle} // Only required for single
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                            />
                        </div>

                        <div className="col-span-1">
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category <span className="text-red-500">*</span></label>
                            <select
                                name="category"
                                id="category"
                                value={formData.category}
                                onChange={handleChange}
                                required
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border bg-white"
                            >
                                <option value="">Select Category</option>
                                <option value="Candles">Candles</option>
                                <option value="Freshener">Freshener</option>
                                <option value="Diffuser">Diffuser</option>
                                <option value="Gift Set">Gift Set</option>
                            </select>
                        </div>
                        
                        {/* Featured (Missing from original template, but in Schema) */}
                        <div className="col-span-1 flex items-center pt-3">
                            <input 
                                type="checkbox" 
                                name="featured" 
                                checked={formData.featured} 
                                onChange={handleChange} 
                                className="h-4 w-4 text-indigo-600 border-gray-300 rounded" 
                            />
                            <label htmlFor="featured" className="ml-2 block text-sm font-medium text-gray-700">Featured Product</label>
                        </div>
                        <div className="col-span-1">
                            <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                            <select
                                name="status"
                                id="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border bg-white"
                            >
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>

                        <div className="col-span-1">
                            <label htmlFor="price_egp" className="block text-sm font-medium text-gray-700">Price (EGP) <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                name="price_egp"
                                id="price_egp"
                                value={formData.price_egp}
                                onChange={handlePriceChange}
                                required
                                min="0"
                                step="0.01"
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                            />
                        </div>

                        <div className="col-span-1">
                            <label htmlFor="stockQuantity" className="block text-sm font-medium text-gray-700">Stock Quantity <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                name="stockQuantity" // Use the state name here
                                id="stockQuantity"
                                value={formData.stock} // Read from the corrected state key
                                onChange={handleStockChange}
                                required
                                min="0"
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                            />
                        </div>

                        <div className="col-span-1">
                            <label htmlFor="size" className="block text-sm font-medium text-gray-700">Size (e.g., "200 gm", "Small", "One Size")</label>
                            <input
                                type="text"
                                name="size"
                                id="size"
                                value={formData.size}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                            />
                        </div>

                        {!isBundle && (
                            <div className="col-span-2">
                                <label htmlFor="scents" className="block text-sm font-medium text-gray-700">Available Scents (Comma separated, e.g., Vanilla, Rose, Musk)</label>
                                <input
                                    type="text"
                                    name="scents"
                                    id="scents"
                                    value={formData.scents.join(', ')}
                                    onChange={handleScentsChange}
                                    className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                                    placeholder="e.g., Apple Cinnamon, Fresh Linen, Tropical Passion"
                                />
                            </div>
                        )}
                    </div>

                    {/* --- Candle Specification Fields (New) --- */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b pb-6">
                        <h2 className="md:col-span-3 text-xl font-bold text-gray-800 border-b pb-2 mb-4">
                            Product Specifications
                        </h2>
                        
                        <div>
                            <label htmlFor="burnTime" className="block text-sm font-medium text-gray-700">Burn Time (e.g., "40-45 hours")</label>
                            <input
                                type="text"
                                name="burnTime"
                                id="burnTime"
                                value={formData.burnTime}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                            />
                        </div>
                        
                        <div>
                            <label htmlFor="wickType" className="block text-sm font-medium text-gray-700">Wick Type (e.g., "Cotton", "Wood")</label>
                            <input
                                type="text"
                                name="wickType"
                                id="wickType"
                                value={formData.wickType}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                            />
                        </div>
                        
                        <div>
                            <label htmlFor="coverageSpace" className="block text-sm font-medium text-gray-700">Coverage Space (e.g., "15-20 m2 bedroom")</label>
                            <input
                                type="text"
                                name="coverageSpace"
                                id="coverageSpace"
                                value={formData.coverageSpace}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                            />
                        </div>
                    </div>


                    {/* --- Descriptions --- */}
                    <div className="space-y-4 border-b pb-6">
                        <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mb-4">
                            Description
                        </h2>
                        
                        {/* Standard Description */}
                        <div>
                            <label htmlFor="description_en" className="block text-sm font-medium text-gray-700">Short Description (English)</label>
                            <textarea
                                name="description_en"
                                id="description_en"
                                value={formData.description_en}
                                onChange={handleChange}
                                rows="3"
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                                placeholder="A concise, enticing summary of the product."
                            ></textarea>
                        </div>
                        
                        {/* Formatted Description (for detailed layout) */}
                        <div>
                            <label htmlFor="formattedDescription" className="block text-sm font-medium text-gray-700">
                                Detailed/Formatted Description (Use Markdown/HTML for **bold**, font size, color)
                            </label>
                            <textarea
                                name="formattedDescription"
                                id="formattedDescription"
                                value={formData.formattedDescription}
                                onChange={handleChange}
                                rows="5"
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                                placeholder="Example: **Key Feature** - Description. \n\n<span style='font-size:1.1em; color:#4F46E5;'>Usage Guide:</span> Apply liberally..."
                            ></textarea>
                        </div>
                    </div>

                    {/* --- Image Uploads (Kept original logic) --- */}
                    <div className="border-b pb-6">
                        <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mb-4">
                            Image Uploads (Max 5) <span className="text-red-500">*</span>
                        </h2>
                        <input
                            type="file"
                            id="file-upload"
                            multiple
                            accept="image/*"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-indigo-50 file:text-indigo-700
                                hover:file:bg-indigo-100"
                        />
                        <p className="mt-2 text-xs text-gray-500">
                            Recommended: High-resolution JPG or PNG. The server will handle Cloudinary upload.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-3">
                            {formData.selectedFiles.map((file, index) => (
                                <div key={index} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
                                    <img 
                                        src={URL.createObjectURL(file)} 
                                        alt={`Preview ${index + 1}`} 
                                        className="w-full h-full object-cover"
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => removeFile(index)} 
                                        className="absolute top-0 right-0 p-1 bg-red-600 text-white rounded-bl-lg opacity-0 group-hover:opacity-100 transition duration-300"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* --- Bundle Configuration Section (Conditional) --- */}
                    {isBundle && (
                        <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-200 space-y-6">
                            <h2 className="text-xl font-bold text-yellow-800 flex items-center">
                                <Package className="w-5 h-5 mr-2" />
                                Bundle Configuration (Up to 10 Items)
                            </h2>
                            {/* Bundle Name/Description Fields */}
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                <input type="text" name="bundleName" placeholder="Bundle Name (e.g., 'Starter Kit')" value={formData.bundleName} onChange={handleChange} required className="col-span-1 rounded-md border-gray-300 shadow-sm p-3 border" />
                                <textarea name="bundleDescription" placeholder="Bundle Description" value={formData.bundleDescription} onChange={handleChange} rows="1" className="col-span-1 rounded-md border-gray-300 shadow-sm p-3 border"></textarea>
                            </div>

                            <p className="text-sm text-yellow-700">
                                Define the components of this bundle and their custom size/scent options for the customer.
                            </p>

                            {formData.bundleItems.map((item, index) => (
                                <div key={index} className="p-4 border border-yellow-300 rounded-lg bg-white shadow-sm relative">
                                    <h3 className="font-semibold text-gray-800 mb-3 flex justify-between items-center">
                                        Component #{index + 1}: {item.subProductName} 
                                        {formData.bundleItems.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeBundleItem(index)}
                                                className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition"
                                                title="Remove Bundle Item"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Item Name (subProductName in Mongoose) */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600">Name (subProductName)</label>
                                            <input
                                                type="text"
                                                value={item.subProductName} // CORRECTED key
                                                onChange={(e) => handleBundleItemChange(index, 'subProductName', e.target.value)} // CORRECTED key
                                                required
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 text-sm border"
                                            />
                                        </div>

                                        {/* Item Size (Variable Input) */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600">Size (e.g., 200 gm)</label>
                                            <input
                                                type="text"
                                                value={item.size}
                                                onChange={(e) => handleBundleItemChange(index, 'size', e.target.value)}
                                                required
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 text-sm border"
                                                placeholder="e.g., 200 gm"
                                            />
                                        </div>

                                        {/* Allowed Scents (Comma Separated) */}
                                        <div className="md:col-span-1">
                                            <label className="block text-xs font-medium text-gray-600">Allowed Scents (Comma separated)</label>
                                            <input
                                                type="text"
                                                value={item.allowedScents.join(', ')}
                                                onChange={(e) => handleBundleScentsChange(index, e.target.value)}
                                                required
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 text-sm border"
                                                placeholder="e.g., Rose, Musk"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {formData.bundleItems.length < 10 && (
                                <button
                                    type="button"
                                    onClick={addBundleItem}
                                    className="flex items-center justify-center w-full py-2 px-4 border border-indigo-300 rounded-lg shadow-sm text-sm font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 transition"
                                >
                                    <Plus className="w-4 h-4 mr-1" /> Add Another Item to Bundle
                                </button>
                            )}
                        </div>
                    )}

                    {/* --- Submission Button --- */}
                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition"
                        >
                            {isSubmitting ? (
                                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                            ) : (
                                <Zap className="w-5 h-5 mr-2" />
                            )}
                            {isSubmitting ? 'Uploading Product...' : 'Save Product to Database'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

window.AdminProductUploader = AdminProductUploader;