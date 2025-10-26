const API_BASE_URL = 'https://siraj-backend.onrender.com'; 
const ITEMS_PER_PAGE = 12;

// CRITICAL FIX: Scent options must be pulled from the product object (Single or Bundle item)
const AVAILABLE_SCENTS = []; // Remove hardcoded list

// ====================================
// 1. DOM & INITIALIZATION
// (No changes needed here)
// ====================================

const searchToggle = document.getElementById('search-toggle');
const cartToggle = document.getElementById('cart-toggle');
const searchModal = document.getElementById('search-modal');
const cartDropdown = document.getElementById('cart-dropdown');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const closeSearch = document.querySelector('.close-search');


document.addEventListener('DOMContentLoaded', () => {
    // Universal Setup (Nav, Search, Cart)
    setupEventListeners();
    loadCartFromStorage();

    // Page-Specific Initialization based on body attribute
    const pageName = document.body.getAttribute('data-page');

    switch (pageName) {
        case 'home':
            fetchAndrenderCategories(); 
            fetchBestsellers();
            break;
        case 'products':
            initProductsPage();
            break;
        case 'bundles':
            initBundlesPage();
            break;
        case 'product-detail':
            loadProductDetails();
            break;
        case 'shopcart':
            renderShopCartPage();
            break;
        case 'checkout':
            setupCheckoutPage();
            break;
        default:
            // Optional: handle default or error state
            break;
    }
});

function setupEventListeners() {
    if (searchToggle) {
        searchToggle.addEventListener('click', () => {
            searchModal.style.display = 'flex';
            searchInput.focus();
        });
    }

    if (closeSearch) {
        closeSearch.addEventListener('click', () => {
            searchModal.style.display = 'none';
            searchResults.innerHTML = '';
        });
    }

    if (cartToggle) {
        cartToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            cartDropdown.style.display = cartDropdown.style.display === 'block' ? 'none' : 'block';
        });
    }

    document.body.addEventListener('click', (e) => {
        if (cartDropdown && !cartDropdown.contains(e.target) && e.target !== cartToggle && cartDropdown.style.display === 'block') {
            cartDropdown.style.display = 'none';
        }
        if (searchModal && !searchModal.contains(e.target) && e.target !== searchToggle && searchModal.style.display === 'flex') {
            searchModal.style.display = 'none';
        }
    });

    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
}

// ====================================
// 2. UNIVERSAL FETCHING & UTILS
// (No changes needed here)
// ====================================

async function fetchGridData(endpoint, page = 1, limit = ITEMS_PER_PAGE, query = '') {
    try {
        // FIX: Corrected API path
        const fullUrl = `${API_BASE_URL}/api${endpoint}?page=${page}&limit=${limit}${query}`;
        const response = await fetch(fullUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json(); 
        
        // FIX: CRITICAL DATA NORMALIZATION - Use 'results' key from JSON response
        const items = result.results || result.bundles || (Array.isArray(result) ? result : result.data || []);
        
        return {
            items: items,
            // FIX: Calculate totalPages using total and limit keys
            totalPages: Math.ceil((result.total || limit) / limit), 
            currentPage: result.page || page
        };
    } catch (error) {
        console.error(`Error fetching data from ${endpoint}:`, error);
        return { items: [], totalPages: 1, currentPage: 1 };
    }
}

function renderProductGrid(containerId, items, endpointType) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `<p>No ${endpointType} found at this time.</p>`;
        return;
    }

    container.innerHTML = items.map(item => {
        // Determine if it is a bundle (using the new schema key for products)
        const isBundle = item.productType === 'Bundle' || item.bundleItems;
        const typeParam = isBundle ? '&type=bundle' : '';
        
        // FIX: Use correct Casing and Key names from the new Admin payload/Mongoose schema
        const itemName = item.name_en || item.bundleName || item['Name (English)'] || 'Unknown Product';
        const itemPrice = item.price_egp || item['Price (EGP)'] || 0;
        // Use the first image from the imagePaths array, or fallback
        const itemImage = item.imagePaths?.[0] || item['Image path'] || 'images/placeholder.jpg';
        
        return `
            <div class="product-card">
                <img src="${itemImage}" alt="${itemName}">
                <div class="product-info">
                    <p class="product-title product-name-bold">${itemName}</p>
                    <p class="product-price">${(itemPrice).toFixed(2)} EGP</p>
                    <button onclick="window.location.href='product.html?id=${item._id}${typeParam}'" class="view-product-btn">View Details</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderPagination(controlsId, totalPages, currentPage, pageFile, loadFunction) {
    const controls = document.getElementById(controlsId);
    if (!controls || totalPages <= 1) return;
    controls.innerHTML = '';

    const createButton = (text, page) => {
        const button = document.createElement('button');
        button.textContent = text;
        // Class for pagination styling
        button.classList.add('pagination-button', 'pagination-bold'); 
        if (page === currentPage) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => {
            window.history.pushState({}, '', `${pageFile}?page=${page}`);
            loadFunction(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        return button;
    };
    
    // Previous button
    if (currentPage > 1) {
        controls.appendChild(createButton('← Previous', currentPage - 1));
    }

    // Page numbers (simple approach)
    for (let i = 1; i <= totalPages; i++) {
        controls.appendChild(createButton(i, i));
    }

    // Next button
    if (currentPage < totalPages) {
        controls.appendChild(createButton('Next →', currentPage + 1));
    }
}

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}


// ====================================
// 3. HOMEPAGE LOGIC
// (No changes needed here)
// ====================================

// FIX: Dynamic CATEGORIES LOGIC (Fetches all products and extracts categories)
async function fetchAndrenderCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;
    
    container.innerHTML = '<p>Loading categories...</p>'; 

    try {
        // Fetch all products (limit 1000 to be safe, as there is no separate /categories endpoint)
        const { items } = await fetchGridData('/products', 1, 1000); 

        if (items.length === 0) {
            container.innerHTML = '<p>No products available to determine categories.</p>';
            return;
        }

        const uniqueCategories = new Set();
        items.forEach(item => {
            const categoryName = item.category || item.bundleCategory || item.Category;
            if (categoryName) {
                uniqueCategories.add(categoryName);
            }
        });

        const categoriesArray = Array.from(uniqueCategories);

        if (categoriesArray.length === 0) {
            container.innerHTML = '<p>Could not extract categories from product data.</p>';
            return;
        }

        // FIX: Render the unique categories as cards (Assuming placeholder images)
        container.innerHTML = categoriesArray.map(name => {
            // Simple placeholder image logic (replace with real images later)
            const imageSrc = name.toLowerCase().includes('candle') ? 'images/placeholder-candle.jpg' : 'images/placeholder-freshener.jpg';
            
            return `
                <a href="products.html?category=${encodeURIComponent(name)}" class="category-card-item">
                    <div class="category-image-wrapper">
                        <img src="${imageSrc}" alt="${name}">
                    </div>
                    <div class="category-info">
                        <p class="category-name">${name}</p>
                        <i class="fas fa-arrow-right"></i>
                    </div>
                </a>
            `;
        }).join('');

    } catch (error) {
        console.error("Error fetching categories:", error);
        container.innerHTML = '<p>Could not load categories. Please check the API connection or CORS policy.</p>';
    }
}
// END OF CATEGORIES LOGIC

async function fetchBestsellers() {
    const container = document.getElementById('bestsellers-container');
    if (!container) return;
    
    container.innerHTML = '<p>Loading bestsellers...</p>';

    try {
        // FIX: Requested 6 best-sellers
        const { items } = await fetchGridData('/products', 1, 6, '&isBestSeller=true'); 
        renderProductGrid('bestsellers-container', items, 'products');

    } catch (error) {
        container.innerHTML = '<p>Could not load bestsellers. Please check the API connection.</p>';
    }
}
// ====================================
// 4. SEARCH LOGIC
// (No changes needed here)
// ====================================

async function handleSearch() {
    const query = searchInput.value.trim();
    if (query.length < 2) {
        searchResults.innerHTML = '<p>Enter at least 2 characters to search.</p>';
        return;
    }
    
    searchResults.innerHTML = '<p>Searching...</p>';
    
    try {
        // Endpoint is '/products' but fetchGridData now adds '/api' and uses 'results' key
        const { items } = await fetchGridData('/products', 1, 5, `&search=${encodeURIComponent(query)}`);

        if (items.length === 0) {
            searchResults.innerHTML = `<p>No results found for "${query}".</p>`;
        } else {
            searchResults.innerHTML = items.map(product => `
                <a href="product.html?id=${product._id}" class="search-result-item">
                                        <p class="search-item-title">${product.name_en || product['Name (English)'] || product.name}</p>
                    <p class="search-item-price">${(product.price_egp || product['Price (EGP)'] || product.price || 0).toFixed(2)} EGP</p>
                </a>
            `).join('');
        }
    } catch (error) {
        searchResults.innerHTML = '<p>Search error. Please try again.</p>';
    }
}

// ====================================
// 5. PRODUCTS GRID PAGE LOGIC
// (No changes needed here)
// ====================================

function initProductsPage() {
    // Setup Filter and Sort Dropdowns/Listeners here
    const filterSortBar = document.getElementById('filter-sort-bar');
    if (filterSortBar) {
        filterSortBar.innerHTML = renderFilterSortBar();
        // Add listeners for filter and sort changes to trigger loadProducts
        document.getElementById('sort-by-select').addEventListener('change', () => loadProducts(1));
        document.getElementById('filter-category-select').addEventListener('change', () => loadProducts(1));
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const initialPage = parseInt(urlParams.get('page')) || 1;
    loadProducts(initialPage);
}

// NEW FUNCTION: Renders the Filter/Sort HTML
function renderFilterSortBar() {
    // Note: Fetching dynamic categories for the filter dropdown is complex
    // and would require an additional fetch call or passing data from the server.
    // For now, we use placeholders as requested, and will build the filtering logic.
    
    // Get current filter/sort settings from URL
    const urlParams = new URLSearchParams(window.location.search);
    const currentSort = urlParams.get('sort') || 'name_asc';
    const currentCategory = urlParams.get('category') || '';
    
    return `
        <div class="filter-controls-group">
            <div class="filter-item">
                <label for="filter-category-select">Category:</label>
                <select id="filter-category-select" class="filter-select" value="${currentCategory}">
                    <option value="">All Categories</option>
                    <option value="Candles">Candles</option>
                    <option value="Freshener">Freshener</option>
                    </select>
            </div>
            
            <div class="filter-item">
                <label for="sort-by-select">Sort By:</label>
                <select id="sort-by-select" class="filter-select" value="${currentSort}">
                    <option value="name_asc" ${currentSort === 'name_asc' ? 'selected' : ''}>Name (A-Z)</option>
                    <option value="price_asc" ${currentSort === 'price_asc' ? 'selected' : ''}>Price (Low to High)</option>
                    <option value="price_desc" ${currentSort === 'price_desc' ? 'selected' : ''}>Price (High to Low)</option>
                    <option value="newest" ${currentSort === 'newest' ? 'selected' : ''}>Newest</option>
                </select>
            </div>
        </div>
    `;
}

// MODIFIED TO HANDLE FILTERS/SORTING
async function loadProducts(page) {
    const container = document.getElementById('products-container');
    const paginationControls = document.getElementById('pagination-controls');

    const sortBy = document.getElementById('sort-by-select')?.value || '';
    const filterCategory = new URLSearchParams(window.location.search).get('category') || document.getElementById('filter-category-select')?.value || '';
    
    // Build query string based on filters
    let query = '';
    if (filterCategory) {
        query += `&category=${encodeURIComponent(filterCategory)}`;
    }
    if (sortBy) {
        const [sortField, sortOrder] = sortBy.split('_');
        query += `&sort=${sortField}&order=${sortOrder}`;
    }
    
    container.innerHTML = '<p class="loading-message">Fetching all products...</p>';
    paginationControls.innerHTML = '';
    
    // Endpoint is '/products' but fetchGridData now adds '/api' and uses 'results' key
    const { items, totalPages, currentPage } = await fetchGridData('/products', page, ITEMS_PER_PAGE, query);

    renderProductGrid('products-container', items, 'products');
    // Ensure pagination is called correctly
    renderPagination('pagination-controls', totalPages, currentPage, 'products.html', loadProducts);
}

// ====================================
// 6. BUNDLES GRID PAGE LOGIC
// (No changes needed here)
// ====================================

function initBundlesPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const initialPage = parseInt(urlParams.get('page')) || 1;
    loadBundles(initialPage);
}

async function loadBundles(page) {
    const container = document.getElementById('bundles-container');
    const paginationControls = document.getElementById('pagination-controls-bundles');
    
    container.innerHTML = '<p class="loading-message">Fetching curated bundles...</p>';
    paginationControls.innerHTML = '';
        
    // Using the product endpoint to fetch only bundle types
    const BUNDLE_ITEMS_PER_PAGE = 9; 
    const { items, totalPages, currentPage } = await fetchGridData('/products', page, BUNDLE_ITEMS_PER_PAGE, '&productType=Bundle');

    renderProductGrid('bundles-container', items, 'bundles');
    renderPagination('pagination-controls-bundles', totalPages, currentPage, 'bundles.html', loadBundles);
}


// ====================================
// 7. SINGLE PRODUCT/BUNDLE LOGIC (with customization)
// ====================================

async function loadProductDetails() {
    const container = document.getElementById('product-detail-container');
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const type = urlParams.get('type') || 'product';
    
    if (!id) {
        container.innerHTML = '<p>No product ID found in URL.</p>';
        return;
    }

    // FIX: Using the unified /api/products/:id endpoint, regardless of type
    const endpoint = `/api/products/${id}`;
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const product = await response.json();
        
        // Determine if it's a bundle based on the Mongoose schema field
        product.isBundle = product.productType === 'Bundle'; 

        renderProduct(product);
        // Use the category key from your new schema/JSON for related products
        fetchRelatedProducts(product.category || product.bundleCategory || 'general', product._id); 
        
    } catch (error) {
        console.error(`Error fetching ${type} details:`, error);
        container.innerHTML = `<p>Could not load ${type} details. Please ensure the ID is correct.</p>`;
    }
}

function renderProduct(product) {
    const container = document.getElementById('product-detail-container');
    
    // FIX: Use consistent key names from the Mongoose schema (name_en, price_egp, imagePaths)
    const isBundle = product.isBundle;
    const itemName = isBundle ? (product.bundleName || 'Custom Bundle') : (product.name_en || 'Unknown Product');
    const itemPrice = product.price_egp || 0;
    // Use the first image from the imagePaths array, or fallback
    const itemImage = product.imagePaths?.[0] || 'images/placeholder.jpg';
    const itemCategory = product.category || product.bundleCategory || 'N/A';
    
    // Scents and Size now come directly from single product fields OR N/A for bundle header
    const itemScents = isBundle ? 'Custom Selection Below' : (product.scents || 'N/A');
    const itemSize = isBundle ? 'Multiple Sizes' : (product.size || 'N/A');
    
    // Description: Check for bundle description first, then single product description
    const itemDescription = (product.bundleDescription || product.description_en || 'No description provided.').replace(/\r?\n/g, '<br>');
    
    // New Admin Fields
    const itemBurnTime = product.burnTime || 'N/A';
    const itemWickType = product.wickType || 'N/A';
    const itemCoverageSpace = product.coverageSpace || 'N/A';
    
    const isOutOfStock = product.stock <= 0;
    
    document.title = `${itemName} | Siraj Candles`;
    document.querySelector('meta[name="description"]').setAttribute('content', (itemDescription).substring(0, 150).replace(/<br>/g, ' ') + '...');
    
    // --- Bundle Customization Logic FIX ---
    let customizationHTML = '';
    const bundleItems = product.bundleItems || [];
    const numItemsInBundle = bundleItems.length;

    if (isBundle && numItemsInBundle > 0) {
        let bundleSelectors = `<div class="bundle-customization-section">
            <p class="customization-prompt product-name-bold">Choose your scents for each item:</p>`;

        bundleItems.forEach((item, i) => {
            // Split the comma-separated string into options
            const scentOptionsArray = item.allowedScents.split(',').map(s => s.trim()).filter(s => s.length > 0);
            
            const scentOptions = scentOptionsArray.map(scent => 
                `<option value="${scent}">${scent}</option>`
            ).join('');

            // Use the subProductName and size from the bundle item
            const bundleItemName = `${item.subProductName} (${item.size})`;
            
            bundleSelectors += `
                <div class="bundle-selector-group">
                    <label for="scent-${i}">${bundleItemName}:</label>
                    <select id="scent-${i}" class="scent-selector" required>
                        <option value="">-- Select a scent --</option>
                        ${scentOptions}
                    </select>
                </div>
            `;
        });
        bundleSelectors += `</div>`;
        customizationHTML = bundleSelectors;
    }
    // ------------------------------------
    
    // Image Gallery Area (Handles multiple images)
    const imageGalleryHTML = (product.imagePaths || []).map((path, index) => `
        <img src="${path}" alt="${itemName} image ${index + 1}" class="${index === 0 ? 'main-product-image' : 'thumbnail-image'}">
    `).join('');

    // Formatted Description Area (Handles admin's styling request)
    const formattedDescHTML = product.formattedDescription 
        ? `<div class="formatted-description-box">${product.formattedDescription.replace(/\r?\n/g, '<br>')}</div>`
        : '';

    container.innerHTML = `
        <div class="product-detail-grid">
            <div class="product-image-area">
                <div class="image-gallery">
                    ${imageGalleryHTML}
                </div>
            </div>
            
            <div class="product-info-area">
                <h1 class="product-title">${itemName}</h1>
                <p class="product-price">${itemPrice.toFixed(2)} EGP</p>
                
                <!-- Core Specs -->
                <div class="product-specs-group">
                    <p class="product-spec">Category: <span>${itemCategory}</span></p>
                    <p class="product-spec">Scents: <span>${itemScents}</span></p>
                    <p class="product-spec">Size: <span>${itemSize}</span></p>
                    
                    ${!isBundle ? `
                        <p class="product-spec">Burn Time: <span>${itemBurnTime}</span></p>
                        <p class="product-spec">Wick Type: <span>${itemWickType}</span></p>
                        <p class="product-spec">Coverage: <span>${itemCoverageSpace}</span></p>
                    ` : ''}
                </div>

                <p class="stock-status ${isOutOfStock ? 'out-of-stock' : 'in-stock'}">
                    ${isOutOfStock ? 'Out of Stock' : 'In Stock'}
                </p>

                <p class="product-description basic-description">
                    ${itemDescription}
                </p>
                
                ${formattedDescHTML}
                
                ${customizationHTML}

                ${!isOutOfStock ? `
                    <div class="product-actions-grid">
                        
                                                <div class="quantity-selector-box">
                            <button class="quantity-minus action-btn">-</button>
                            <input type="number" id="quantity" value="1" min="1" max="${product.stock || 10}" readonly class="quantity-input-box">
                            <button class="quantity-plus action-btn">+</button>
                        </div>

                                                <button id="add-to-cart-btn" class="action-add-to-cart-btn" 
                                data-is-bundle="${isBundle}" data-bundle-items="${numItemsInBundle}">
                            <span class="cart-icon">🛒</span> Add to Cart
                        </button>

                                                <button class="buy-it-now-btn action-buy-now-btn">Buy it Now</button>
                    </div>
                ` : '<button class="action-add-to-cart-btn out-of-stock-btn" disabled>Notify Me When Available</button>'}
                <div class="related-products-section">
                    <h3>Products You Might Like (4 in a row)</h3>
                    <div id="related-products-container" class="product-grid related-grid">
                        </div>
                </div>

                <div class="shipping-returns">
                    <h3>Shipping & Returns</h3>
                    <ul>
                        <li>Orders processed within 1–2 business days.</li>
                        <li>Delivery across Egypt within 2–5 days.</li>
                        <li>Returns accepted within 7 days for unused items.</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    
    // Add quantity button listeners
    const quantityInput = document.getElementById('quantity');
    document.querySelector('.quantity-minus')?.addEventListener('click', () => {
        if (parseInt(quantityInput.value) > 1) {
            quantityInput.value = parseInt(quantityInput.value) - 1;
        }
    });
    document.querySelector('.quantity-plus')?.addEventListener('click', () => {
        if (parseInt(quantityInput.value) < (product.stock || 10)) {
            quantityInput.value = parseInt(quantityInput.value) + 1;
        }
    });

    if (!isOutOfStock) {
        document.getElementById('add-to-cart-btn').addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const isBundleBtn = btn.getAttribute('data-is-bundle') === 'true';
            const quantity = parseInt(quantityInput ? quantityInput.value : 1);
            
            let customization = null;
            
            if (isBundleBtn) {
                // Pass the number of items in the bundle for validation
                customization = collectBundleScents(numItemsInBundle); 
                if (!customization) return; // Stops if not all scents are selected
            }
            
            // FIX: Use consistent key names
            const item = {
                _id: product._id,
                name: itemName,
                price: itemPrice,
                quantity: quantity,
                customization: customization,
                // Add the image path for the cart display
                imageUrl: product.imagePaths?.[0] || 'images/placeholder.jpg'
            };
            // NOTE: Replaced window.alert with console.log/message box for compatibility
            addToCart(item);
        });
    }
}

function collectBundleScents(numItems) {
    const scents = [];
    let allSelected = true;
    for (let i = 0; i < numItems; i++) { // FIX: Start loop from 0 to match element IDs (scent-0, scent-1)
        const selector = document.getElementById(`scent-${i}`); // FIX: Index starting at 0
        if (!selector || selector.value === "") {
            // FIX: Using console.error instead of alert()
            console.error(`Please choose a scent for Item ${i + 1}.`); 
            selector.focus();
            allSelected = false;
            break;
        }
        scents.push(selector.value);
    }
    
    if (allSelected) {
        return scents;
    }
    return null;
}

async function fetchRelatedProducts(category, excludeId) {
    const container = document.getElementById('related-products-container');
    container.innerHTML = '<p>Loading related products...</p>';
    try {
        // FIX: Requested limit 4 for related products
        const query = `&category=${category}&limit=4&exclude_id=${excludeId}`;
        // Endpoint is '/products' but fetchGridData now adds '/api' and uses 'results' key
        const { items } = await fetchGridData('/products', 1, 4, query);
        renderProductGrid('related-products-container', items, 'products');
    } catch (error) {
        container.innerHTML = '<p>Could not load related products.</p>';
    }
}


// ====================================
// 8. CART MANAGEMENT
// ====================================

let cart = [];

function loadCartFromStorage() {
    const cartData = localStorage.getItem('sirajCart');
    if (cartData) {
        cart = JSON.parse(cartData);
    }
    updateCartUI(); 
}

function saveCartToStorage() {
    localStorage.setItem('sirajCart', JSON.stringify(cart));
}

function getCartUniqueId(product) {
    // Customization makes an item unique even if the base ID is the same
    if (product.customization) {
        return `${product._id}_${JSON.stringify(product.customization)}`;
    }
    return product._id;
}

function addToCart(product) {
    const uniqueId = getCartUniqueId(product);
    const existingItem = cart.find(item => getCartUniqueId(item) === uniqueId);
    
    if (existingItem) {
        existingItem.quantity += product.quantity || 1;
    } else {
        cart.push({ ...product, cartItemId: uniqueId, quantity: product.quantity || 1 });
    }
    saveCartToStorage();
    updateCartUI();
    // FIX: Replaced alert() with a console log
    console.log(`${product.name} (x${product.quantity || 1}) added to cart!`);
}
window.addToCart = addToCart; // Expose globally

function removeItemFromCart(id) {
    cart = cart.filter(item => getCartUniqueId(item) !== id);
    saveCartToStorage();
    updateCartUI();
    if (document.body.getAttribute('data-page') === 'shopcart') {
        renderShopCartPage();
    }
}
window.removeItemFromCart = removeItemFromCart;

function updateItemQuantity(id, quantity) {
    const item = cart.find(item => getCartUniqueId(item) === id);
    if (item) {
        const newQuantity = parseInt(quantity);
        if (newQuantity > 0) {
            item.quantity = newQuantity;
        } else {
            removeItemFromCart(id);
            return;
        }
    }
    saveCartToStorage();
    updateCartUI();
    if (document.body.getAttribute('data-page') === 'shopcart') {
        renderShopCartPage();
    }
}
window.updateItemQuantity = updateItemQuantity;

function getCartTotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function updateCartUI() {
    const cartCountElement = document.querySelector('.cart-count');
    const cartListElement = document.querySelector('.cart-items-list');
    const cartTotalElement = document.getElementById('cart-total');
    
    if (!cartCountElement || !cartTotalElement) return;

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = getCartTotal();
    
    // FIX: Hide the counter element if totalItems is 0
    if (totalItems === 0) {
        cartCountElement.style.visibility = 'hidden'; 
        cartCountElement.style.opacity = 0;
    } else {
        cartCountElement.style.visibility = 'visible'; 
        cartCountElement.style.opacity = 1;
        cartCountElement.textContent = totalItems;
    }
    
    if (cartListElement) {
        if (cart.length === 0) {
            cartListElement.innerHTML = '<p class="empty-cart-message">Your cart is empty.</p>';
        } else {
            cartListElement.innerHTML = cart.map(item => {
                const customizationDetail = item.customization ? 
                    `<br><small>(${item.customization.slice(0, 2).join(', ')}${item.customization.length > 2 ? '...' : ''})</small>` 
                    : '';
                return `
                    <div class="cart-item">
                        <p>${item.name} x ${item.quantity} ${customizationDetail}</p>
                        <p>${(item.price * item.quantity).toFixed(2)} EGP</p>
                    </div>
                `;
            }).join('');
        }
    }
}

// ====================================
// 9. SHOP CART PAGE LOGIC
// ====================================

function renderShopCartPage() {
    const itemsContainer = document.getElementById('cart-items-table');
    const summaryContainer = document.getElementById('cart-summary');
    
    if (!itemsContainer || !summaryContainer) return;

    if (cart.length === 0) {
        itemsContainer.innerHTML = '<tr><td colspan="5" class="empty-cart-message-full">Your cart is empty. <a href="products.html">Start Shopping!</a></td></tr>';
        summaryContainer.innerHTML = '';
        document.getElementById('checkout-link-bottom').style.display = 'none';
        return;
    }

    // Render Items Table
    itemsContainer.innerHTML = cart.map(item => {
        const uniqueId = getCartUniqueId(item);
        const customizationDetail = item.customization ? 
            `<div class="cart-customization-detail"><small>Scents: ${item.customization.join(', ')}</small></div>` 
            : '';
        // Use item.imageUrl which we added to cart item
        const itemImage = item.imageUrl || 'images/placeholder.jpg';

        return `
            <tr data-id="${uniqueId}">
                <td class="cart-product-col" data-label="Product">
                    <img src="${itemImage}" alt="${item.name}" class="cart-item-img">
                    <div>
                        <a href="product.html?id=${item._id}">${item.name}</a>
                        ${customizationDetail}
                    </div>
                </td>
                <td data-label="Price">${item.price.toFixed(2)} EGP</td>
                <td data-label="Quantity">
                    <input type="number" value="${item.quantity}" min="1" class="item-quantity-input" 
                           onchange="updateItemQuantity('${uniqueId}', this.value)" 
                           onkeyup="updateItemQuantity('${uniqueId}', this.value)">
                </td>
                <td data-label="Total">${(item.price * item.quantity).toFixed(2)} EGP</td>
                <td data-label="Remove">
                    <button class="remove-item-btn" onclick="removeItemFromCart('${uniqueId}')"><i class="fas fa-times"></i></button>
                </td>
            </tr>
        `;
    }).join('');

    const subtotal = getCartTotal();
    const shipping = subtotal >= 2000 ? 0.00 : 50.00;
    const grandTotal = subtotal + shipping;

    // Render Summary
    summaryContainer.innerHTML = `
        <h3>Cart Summary</h3>
        <p>Subtotal: <span>${subtotal.toFixed(2)} EGP</span></p>
        <p>Shipping (Egypt): <span>${shipping.toFixed(2)} EGP</span></p>
        <p class="cart-total-final">Grand Total: <span>${grandTotal.toFixed(2)} EGP</span></p>
        <a href="checkout.html" class="checkout-btn">Proceed to Checkout</a>
    `;
    
    document.getElementById('checkout-link-bottom').style.display = 'block';
}


// ====================================
// 10. CHECKOUT PAGE LOGIC
// (No changes needed here)
// ====================================

function setupCheckoutPage() {
    const summaryContainer = document.getElementById('checkout-summary-container');
    const checkoutForm = document.getElementById('checkout-form');
    
    if (cart.length === 0) {
        summaryContainer.innerHTML = '<p>Your cart is empty. <a href="products.html">Return to shopping.</a></p>';
        if (checkoutForm) checkoutForm.style.display = 'none';
        return;
    }
    
    renderCheckoutSummary(summaryContainer);
    
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', processCheckout);
    }
}

function renderCheckoutSummary(container) {
    const subtotal = getCartTotal();
    const shipping = subtotal >= 2000 ? 0.00 : 50.00;
    const grandTotal = subtotal + shipping;

    container.innerHTML = `
        <h3>Order Summary</h3>
        <div class="checkout-item-list">
            ${cart.map(item => {
                const customizationDetail = item.customization ? 
                    `<small> (${item.customization.join(', ')})</small>` : '';
                return `
                    <p class="checkout-item">${item.name} x ${item.quantity}${customizationDetail} 
                    <span>${(item.price * item.quantity).toFixed(2)} EGP</span></p>
                `;
            }).join('')}
        </div>
        <hr>
        <p class="checkout-summary-line">Subtotal: <span>${subtotal.toFixed(2)} EGP</span></p>
        <p class="checkout-summary-line">Shipping: <span>${shipping.toFixed(2)} EGP</span></p>
        <p class="checkout-summary-line final-total">Total: <span>${grandTotal.toFixed(2)} EGP</span></p>
    `;
}

async function processCheckout(e) {
    e.preventDefault();
    
    const checkoutForm = e.target;
    const formData = new FormData(checkoutForm);
    const totalAmount = getCartTotal();
    const shippingFee = totalAmount >= 2000 ? 0.00 : 50.00;

    const orderData = {
        customerInfo: {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            address: formData.get('address'),
            city: formData.get('city'),
            notes: formData.get('notes'),
        },
        items: cart.map(item => ({
            productId: item._id, // Base product ID
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            customization: item.customization || null // Include customization details
        })),
        totalAmount: totalAmount + shippingFee,
        subtotal: totalAmount,
        shippingFee: shippingFee,
        paymentMethod: formData.get('payment-method'),
    };
    
    const submitBtn = document.getElementById('place-order-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    try {
        // FIX: Corrected API path
        const response = await fetch(`${API_BASE_URL}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();

        if (response.ok) {
            // FIX: Replaced alert() with console.log
            console.log('Order placed successfully! Your Order ID is: ' + result.orderId);
            cart = []; 
            saveCartToStorage();
            updateCartUI();
            window.location.href = 'index.html'; 
        } else {
            throw new Error(result.message || 'Failed to place order.');
        }

    } catch (error) {
        // FIX: Replaced alert() with console.error
        console.error('Order failed: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Place Order';
    }
}
