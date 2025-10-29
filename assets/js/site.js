const API_BASE_URL = 'https://siraj-backend.onrender.com'; 
const ITEMS_PER_PAGE = 12;

// CRITICAL FIX: Scent options must be pulled from the product object (Single or Bundle item)
const AVAILABLE_SCENTS = []; // Remove hardcoded list

// ====================================
// 1. DOM & INITIALIZATION
// ====================================

const searchToggle = document.getElementById('search-toggle');
const cartToggle = document.getElementById('cart-toggle');
const searchModal = document.getElementById('search-modal');
const cartDropdown = document.getElementById('cart-dropdown');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const closeSearch = document.querySelector('.close-search');

document.addEventListener('DOMContentLoaded', () => {
    // ====================================
    // SAFETY CHECK: Error Handling for Missing Elements
    // ====================================
    const requiredElements = ['search-toggle', 'cart-toggle', 'mobile-menu-toggle'];
    requiredElements.forEach(id => {
        if (!document.getElementById(id)) {
            console.warn(`Required element #${id} not found`);
        }
    });

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

    // --- Mobile Menu Toggle Logic ---
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-nav-menu');

    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            // Toggle 'active' class on both button and menu
            menuToggle.classList.toggle('active');
            mobileMenu.classList.toggle('active');
            document.body.classList.toggle('mobile-menu-open');
        });
    }

    // This body click listener handles closing popups
    document.body.addEventListener('click', (e) => {
        if (cartDropdown && !cartDropdown.contains(e.target) && e.target !== cartToggle && cartDropdown.style.display === 'block') {
            cartDropdown.style.display = 'none';
        }
        if (searchModal && !searchModal.contains(e.target) && e.target !== searchToggle && searchModal.style.display === 'flex') {
            searchModal.style.display = 'none';
        }
        // ADDED: Close mobile menu if clicking outside
        if (mobileMenu && mobileMenu.classList.contains('active') && !mobileMenu.contains(e.target) && e.target !== menuToggle && !menuToggle.contains(e.target)) {
            menuToggle.classList.remove('active');
            mobileMenu.classList.remove('active');
            document.body.classList.remove('mobile-menu-open');
        }
    });

    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
}

// ====================================
// 2. UNIVERSAL FETCHING & UTILS
// ====================================

async function fetchGridData(endpoint, page = 1, limit = ITEMS_PER_PAGE, query = '') {
    try {
        const fullUrl = `${API_BASE_URL}/api${endpoint}?page=${page}&limit=${limit}${query}`;
        const response = await fetch(fullUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json(); 
        
        const items = result.results || result.bundles || (Array.isArray(result) ? result : result.data || []);
        
        return {
            items: items,
            totalPages: Math.ceil((result.total || limit) / limit), 
            currentPage: result.page || page
        };
    } catch (error) {
        console.error(`Error fetching data from ${endpoint}:`, error);
        return { items: [], totalPages: 1, currentPage: 1 };
    }
}

// FIXED: Product grid rendering
function renderProductGrid(containerId, items, endpointType) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `<p class="no-products-message">No ${endpointType} found at this time.</p>`;
        return;
    }

    // Ensure container has the correct grid class
    if (!container.classList.contains('product-grid')) {
        container.classList.add('product-grid');
    }

    container.innerHTML = items.map(item => {
        const isBundle = item.productType === 'Bundle' || item.bundleItems;
        const itemName = item.name_en || item.bundleName || item['Name (English)'] || 'Unknown Product';
        const itemPrice = item.price_egp || item['Price (EGP)'] || 0;
        const itemImage = item.imagePaths?.[0] || item['Image path'] || 'images/placeholder.jpg';
        
        return `
            <a href="product.html?id=${item._id}" class="product-card">
                <img src="${itemImage}" alt="${itemName}" loading="lazy"> 
                <div class="product-info-minimal">
                    <p class="product-title">${itemName}</p>
                    <p class="product-price">${itemPrice.toFixed(2)} EGP</p>
                </div>
            </a>
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
// 3. HOMEPAGE LOGIC (UPDATED)
// ====================================

// FIX: Dynamic CATEGORIES LOGIC
async function fetchAndrenderCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;

    container.innerHTML = '<p class="loading-message">Loading categories...</p>';

    try {
        const { items } = await fetchGridData('/products', 1, 100);

        if (!items || items.length === 0) {
            container.innerHTML = '<p class="no-products-message">No products available to determine categories.</p>';
            return;
        }

        const uniqueCategories = new Set();
        items.forEach(item => {
            const categoryName = item.category;
            if (categoryName) {
                uniqueCategories.add(categoryName);
            }
        });

        const categoriesArray = Array.from(uniqueCategories);

        if (categoriesArray.length === 0) {
            container.innerHTML = '<p class="no-products-message">Could not extract categories from product data.</p>';
            return;
        }

        // Render categories with simplified structure
        container.innerHTML = categoriesArray.map(name => {
            const imageSrc = name.toLowerCase().includes('candle') ? 'images/placeholder-candle.jpg' : 'images/placeholder-freshener.jpg';

            return `
                <a href="products.html?category=${encodeURIComponent(name)}" class="category-card-item">
                    <div class="category-image-wrapper">
                        <img src="${imageSrc}" alt="${name}" class="category-image" loading="lazy">
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
        container.innerHTML = '<p class="error-message">Could not load categories. Please try again later.</p>';
    }
}

async function fetchBestsellers() {
    const container = document.getElementById('bestsellers-container');
    if (!container) return;

    container.innerHTML = '<p class="loading-message">Loading bestsellers...</p>';

    try {
        const { items } = await fetchGridData('/products', 1, 6, '&featured=true');
        renderProductGrid('bestsellers-container', items, 'bestsellers');

    } catch (error) {
        console.error("Error fetching bestsellers:", error);
        container.innerHTML = '<p class="error-message">Could not load bestsellers. Please try again later.</p>';
    }
}

// ====================================
// 4. SEARCH LOGIC
// ====================================

async function handleSearch() {
    const query = searchInput.value.trim();
    if (query.length < 2) {
        searchResults.innerHTML = '<p>Enter at least 2 characters to search.</p>';
        return;
    }

    searchResults.innerHTML = '<p>Searching...</p>';
    searchResults.style.display = 'block';

    try {
        const { items } = await fetchGridData('/products', 1, 5, `&search=${encodeURIComponent(query)}`);

        if (!items || items.length === 0) {
            searchResults.innerHTML = `<p>No results found for "${query}".</p>`;
        } else {
            searchResults.innerHTML = items.map(product => {
                const productName = product.name_en || product.bundleName || product.name || 'Product';
                const productPrice = product.price_egp || product.price || 0;
                 return `
                    <a href="product.html?id=${product._id}" class="search-result-item">
                        <span class="search-item-title">${productName}</span>
                        <span class="search-item-price">${productPrice.toFixed(2)} EGP</span>
                    </a>
                 `;
            }).join('');
        }
    } catch (error) {
        console.error("Search error:", error);
        searchResults.innerHTML = '<p class="error-message">Search error. Please try again.</p>';
    }
}

// ====================================
// 5. PRODUCTS GRID PAGE LOGIC
// ====================================

function initProductsPage() {
    const filterSortBar = document.getElementById('filter-sort-bar');
    if (filterSortBar) {
        filterSortBar.innerHTML = renderFilterSortBar();
        document.getElementById('sort-by-select').addEventListener('change', () => loadProducts(1));
        document.getElementById('filter-category-select').addEventListener('change', () => loadProducts(1));
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const initialPage = parseInt(urlParams.get('page')) || 1;
    loadProducts(initialPage);
}

function renderFilterSortBar() {
    const urlParams = new URLSearchParams(window.location.search);
    const currentSort = urlParams.get('sort') || 'name_asc';
    const currentCategory = urlParams.get('category') || '';
    
    return `
        <div class="filter-controls-group">
            <div class="filter-row">
                <div class="filter-item">
                    <label for="filter-category-select">Category:</label>
                    <select id="filter-category-select" class="filter-select">
                        <option value="">All Categories</option>
                        <option value="Candles" ${currentCategory === 'Candles' ? 'selected' : ''}>Candles</option>
                        <option value="Pottery Collection" ${currentCategory === 'Pottery Collection' ? 'selected' : ''}>Pottery Collection</option>
                        <option value="Wax Burners" ${currentCategory === 'Wax Burners' ? 'selected' : ''}>Wax Burners</option>
                        <option value="Fresheners" ${currentCategory === 'Fresheners' ? 'selected' : ''}>Fresheners</option>
                        <option value="Wax Melts" ${currentCategory === 'Wax Melts' ? 'selected' : ''}>Wax Melts</option>
                        <option value="Car Diffusers" ${currentCategory === 'Car Diffusers' ? 'selected' : ''}>Car Diffusers</option>
                        <option value="Reed Diffusers" ${currentCategory === 'Reed Diffusers' ? 'selected' : ''}>Reed Diffusers</option>
                        <option value="Deodorant" ${currentCategory === 'Deodorant' ? 'selected' : ''}>Deodorant</option>
      _                 <option value="Soap" ${currentCategory === 'Soap' ? 'selected' : ''}>Soap</option>
                        <option value="Body Splash" ${currentCategory === 'Body Splash' ? 'selected' : ''}>Body Splash</option>
                        <option value="Shimmering Body Oil" ${currentCategory === 'Shimmering Body Oil' ? 'selected' : ''}>Shimmering Body Oil</option>
                        <option value="Massage Candles" ${currentCategory === 'Massage Candles' ? 'selected' : ''}>Massage Candles</option>
                        <option value="Fizzy Salts" ${currentCategory === 'Fizzy Salts' ? 'selected' : ''}>Fizzy Salts</option>
                        <option value="Sets" ${currentCategory === 'Sets' ? 'selected' : ''}>Sets</option>
                        <option value="Bundles" ${currentCategory === 'Bundles' ? 'selected' : ''}>Bundles</option>
                    </select>
                </div>
                
                <div class="filter-item">
                    <label for="sort-by-select">Sort By:</label>
                    <select id="sort-by-select" class="filter-select">
                        <option value="name_asc" ${currentSort === 'name_asc' ? 'selected' : ''}>Name (A-Z)</option>
                        <option value="price_asc" ${currentSort === 'price_asc' ? 'selected' : ''}>Price (Low to High)</option>
                        <option value="price_desc" ${currentSort === 'price_desc' ? 'selected' : ''}>Price (High to Low)</option>
                        <option value="newest" ${currentSort === 'newest' ? 'selected' : ''}>Newest</option>
                    </select>
                </div>
            </div>
        </div>
    `;
}

async function loadProducts(page) {
    const container = document.getElementById('products-container');
    const paginationControls = document.getElementById('pagination-controls');

    const sortBy = document.getElementById('sort-by-select')?.value || '';
    const filterCategory = new URLSearchParams(window.location.search).get('category') || document.getElementById('filter-category-select')?.value || '';
    
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
    
    const { items, totalPages, currentPage } = await fetchGridData('/products', page, ITEMS_PER_PAGE, query);

    renderProductGrid('products-container', items, 'products');
    renderPagination('pagination-controls', totalPages, currentPage, 'products.html', loadProducts);
}

// ====================================
// 6. BUNDLES GRID PAGE LOGIC
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
        
    const BUNDLE_ITEMS_PER_PAGE = 9; 
    const { items, totalPages, currentPage } = await fetchGridData('/products', page, BUNDLE_ITEMS_PER_PAGE, '&productType=Bundle');

    renderProductGrid('bundles-container', items, 'bundles');
    renderPagination('pagination-controls-bundles', totalPages, currentPage, 'bundles.html', loadBundles);
}

// ====================================
// 7. SINGLE PRODUCT/BUNDLE LOGIC (ENHANCED)
// ====================================

async function loadProductDetails() {
    const container = document.getElementById('product-detail-container');
    if (!container) { 
        console.error("Product detail container not found"); 
        return; 
    }
    container.innerHTML = '<p class="loading-message">Loading product details...</p>';

    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (!id) { 
        container.innerHTML = '<p class="error-message">No product ID found in URL.</p>'; 
        return; 
    }

    const endpoint = `/products/${id}`;
    try {
        const response = await fetch(`${API_BASE_URL}/api${endpoint}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status} - ${errorData.message || 'Not Found'}`);
        }
        const product = await response.json();
        product.isBundle = product.productType === 'Bundle';

        renderProduct(product);

        // Fetch related products
        const relatedContainer = document.getElementById('related-products-container');
        if (relatedContainer) {
            fetchRelatedProducts(product.category || 'general', product._id);
        }

    } catch (error) {
        console.error(`Error fetching product details for ID ${id}:`, error);
        container.innerHTML = `<p class="error-message">Could not load product details. ${error.message}. Please try again later.</p>`;
    }
}

// FIXED: Related products function moved to proper scope
async function fetchRelatedProducts(category, excludeId) {
    const container = document.getElementById('related-products-container');
    if (!container) {
        console.warn("Related products container not found, skipping fetch.");
        return;
    }

    try {
        const query = `&category=${encodeURIComponent(category)}&limit=4&exclude_id=${excludeId}&status=Active`;
        const { items } = await fetchGridData('/products', 1, 4, query);
        
        if (document.getElementById('related-products-container')) {
            renderProductGrid('related-products-container', items, 'related products');
        }
    } catch (error) {
        console.error("Error fetching related products:", error);
        if (document.getElementById('related-products-container')) {
            container.innerHTML = '<p class="error-message">Could not load related products.</p>';
        }
    }
}

// ENHANCED: Product rendering function with new specifications and options
function renderProduct(product) {
    const container = document.getElementById('product-detail-container');
    if (!container) return;

    const isBundle = product.isBundle;
    const itemName = isBundle ? product.bundleName : product.name_en;
    const itemPrice = product.price_egp || product.price || 0;
    const itemCategory = product.category || 'N/A';
    const itemStock = product.stock || 0;
    const isOutOfStock = itemStock <= 0;

    // Render main product details first
    renderMainProductDetails(container, product, isBundle, itemName, itemPrice, itemCategory, itemStock, isOutOfStock);

    // Render dynamic specifications based on category (FIXED: Original table layout)
    renderProductSpecifications(product);

    // Render selectable options if available
    renderProductOptions(product);

    // Render bundle items if it's a bundle
    if (isBundle) {
        renderBundleItems(product);
    }

    attachQuantityButtonListeners(itemStock);
    attachAddToCartListener(product);
    
    // NEW: Setup Buy Now button
    setupBuyNowButton(product);
}

function renderMainProductDetails(container, product, isBundle, itemName, itemPrice, itemCategory, itemStock, isOutOfStock) {
    // Attributes for main product display
    const attributes = [];
    if (!isBundle) {
        if (product.scents) attributes.push({ label: 'Scent', value: product.scents ?? 'N/A', icon: '🌸' });
        if (product.size) attributes.push({ label: 'Size', value: product.size ?? 'N/A', icon: '📏' });
        // Removed detailed specs - they'll be in the specifications section
    }

    // Descriptions
    const shortDescription = isBundle ? product.bundleDescription : product.description_en;
    const formattedDescriptionHTML = product.formattedDescription
        ? `<div class="formatted-description-box">${product.formattedDescription.replace(/\r?\n/g, '<br>')}</div>`
        : '';

    // Image Gallery
    const imagePaths = product.imagePaths || product.images || [];
    const imageGalleryHTML = imagePaths
        .map((path, index) => `<img src="${path}" alt="${itemName || 'Product'} image ${index + 1}" class="${index === 0 ? 'main-product-image' : 'thumbnail-image'}" loading="lazy">`)
        .join('');

    // Update Meta Description & Title
    document.title = `${itemName || 'Product'} | Siraj Candles`;
    const metaDesc = (shortDescription || '').substring(0, 150).replace(/<br>/g, ' ');
    document.querySelector('meta[name="description"]')?.setAttribute('content', metaDesc + (metaDesc.length === 150 ? '...' : ''));

    container.innerHTML = `
        <div class="product-detail-grid-new"> 
            <div class="product-image-area-new">
                <div class="image-gallery">
                    ${imageGalleryHTML || '<img src="images/placeholder.jpg" alt="Placeholder" class="main-product-image">'}
                </div>
            </div>

            <div class="product-info-area-new">
                <h1 class="product-title-main">${itemName || 'Product Name'}</h1>
                <p class="product-category-subtle">${itemCategory}</p> 
                <p class="product-price-main">${itemPrice.toFixed(2)} EGP</p>

                ${!isOutOfStock ? `
                    <div class="product-actions-grid">
                        <div class="quantity-selector-box">
                            <button class="quantity-minus action-btn" data-action="minus" aria-label="Decrease quantity">-</button>
                            <input type="number" id="quantity" value="1" min="1" max="${itemStock || 10}" readonly class="quantity-input-box" aria-label="Quantity">
                            <button class="quantity-plus action-btn" data-action="plus" aria-label="Increase quantity">+</button>
                        </div>
                        <button id="add-to-cart-btn" class="action-add-to-cart-btn">
                            <span class="cart-icon" aria-hidden="true">🛒</span> Add to Cart
                        </button>
                        <button class="buy-it-now-btn action-buy-now-btn">Buy it Now</button>
                    </div>
                ` : `
                    <p class="stock-status out-of-stock">Out of Stock</p>
                    <button class="action-add-to-cart-btn out-of-stock-btn" disabled>Notify Me When Available</button>
                `}

                <div class="product-description-section">
                     <h3 class="section-subtitle">Description</h3> 
                     ${shortDescription ? `<p>${shortDescription.replace(/\r?\n/g, '<br>')}</p>` : '<p>No description provided.</p>'}
                     ${formattedDescriptionHTML} 
                </div>

                ${attributes.length > 0 ? `
                    <div class="product-attributes-section"> 
                        <h3 class="section-subtitle">Quick Details</h3> 
                        <div class="product-attributes-grid">
                            ${attributes.map(attr => `
                                <div class="attribute-chip">
                                    <span class="attribute-icon" aria-hidden="true">${attr.icon || '🔹'}</span>
                                    <span class="attribute-label">${attr.label}:</span>
                                    <span class="attribute-value">${attr.value}</span>
Â                           </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                ${isOutOfStock ? '' : '<p class="stock-status in-stock" aria-live="polite">In Stock</p>'}

                 <div class="shipping-returns-new">
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
}

// FIXED: Render product specifications with original table layout
function renderProductSpecifications(product) {
    const section = document.getElementById('product-specifications-section');
    const container = document.getElementById('specifications-container');
    
    if (!section || !container) return;

    const specs = [];
    const category = product.category;

    // Define specifications for each category
    switch (category) {
        case 'Candles':
        case 'Pottery Collection':
            if (product.burnTime) specs.push({ label: 'BURN TIME', value: product.burnTime });
            if (product.wickType) specs.push({ label: 'WICK TYPE', value: product.wickType });
            if (product.coverageSpace) specs.push({ label: 'COVERAGE SPACE', value: product.coverageSpace });
            if (product.scents && !product.scentOptions) specs.push({ label: 'SCENT', value: product.scents });
            break;
            
        case 'Deodorant':
            if (product.scents) specs.push({ label: 'SCENT', value: product.scents });
            if (product.skinType) specs.push({ label: 'SKIN TYPE', value: product.skinType });
            if (product.keyIngredients) specs.push({ label: 'KEY INGREDIENTS', value: product.keyIngredients });
            break;
            
        case 'Soap':
            if (product.scents) specs.push({ label: 'SCENT', value: product.scents });
            if (product.soapWeight) specs.push({ label: 'WEIGHT', value: product.soapWeight });
            if (product.featureBenefit) specs.push({ label: 'FEATURE', value: product.featureBenefit });
            if (product.keyIngredients) specs.push({ label: 'KEY INGREDIENTS', value: product.keyIngredients });
            break;
            
        case 'Body Splash':
            if (product.scents) specs.push({ label: 'SCENT', value: product.scents });
            break;
            
        case 'Shimmering Body Oil':
            if (product.color) specs.push({ label: 'COLOR', value: product.color });
            if (product.scents) specs.push({ label: 'SCENT', value: product.scents });
            if (product.oilWeight) specs.push({ label: 'SIZE', value: product.oilWeight });
            break;
            
        case 'Massage Candles':
            if (product.scents) specs.push({ label: 'SCENT', value: product.scents });
            if (product.massageWeight) specs.push({ label: 'WEIGHT', value: product.massageWeight });
            break;
            
        case 'Wax Burners':
            if (product.dimensions) specs.push({ label: 'DIMENSIONS', value: product.dimensions });
            break;
            
        case 'Fizzy Salts':
            if (product.fizzySpecs) specs.push({ label: 'SPECIFICATIONS', value: product.fizzySpecs });
            break;
    }

    if (specs.length > 0) {
        section.style.display = 'block';
        
        // Create table rows with 4 columns per row
        let tableHTML = '<table class="specifications-table">';
        tableHTML += '<tr>';
        
        specs.forEach((spec, index) => {
            tableHTML += `
                <th>${spec.label}</th>
                <td>${spec.value}</td>
            `;
            
            // Start new row after every 2 specs (4 cells)
            if ((index + 1) % 2 === 0 && index !== specs.length - 1) {
                tableHTML += '</tr><tr>';
            }
        });
        
        // Fill remaining cells if needed
        const remainingCells = 4 - (specs.length * 2 % 4);
        if (remainingCells > 0 && remainingCells < 4) {
            for (let i = 0; i < remainingCells; i++) {
                tableHTML += '<td></td>';
            }
        }
        
        tableHTML += '</tr></table>';
        container.innerHTML = tableHTML;
    } else {
        section.style.display = 'none';
    }
}

// NEW: Render selectable options
function renderProductOptions(product) {
    const section = document.getElementById('product-options-section');
    const container = document.getElementById('options-container');
    
    if (!section || !container) return;

    const options = [];
    const category = product.category;

    // Define options for each category
    if (product.scentOptions) {
        const scents = product.scentOptions.split(',').map(s => s.trim()).filter(Boolean);
        if (scents.length > 0) {
            options.push({
                type: 'select',
                id: 'scent-option',
                label: 'Choose Scent',
                options: scents,
                required: true
            });
        }
    }

    if (product.sizeOptions) {
        const sizes = product.sizeOptions.split(',').map(s => s.trim()).filter(Boolean);
        if (sizes.length > 0) {
            options.push({
                type: 'select',
                id: 'size-option',
                label: 'Choose Size',
                options: sizes,
                required: true
            });
        }
    }

    if (product.weightOptions) {
        const weights = product.weightOptions.split(',').map(s => s.trim()).filter(Boolean);
        if (weights.length > 0) {
            options.push({
                type: 'select',
                id: 'weight-option',
                label: 'Choose Weight',
                options: weights,
                required: true
            });
        }
    }

    if (product.typeOptions) {
        const types = product.typeOptions.split(',').map(s => s.trim()).filter(Boolean);
        if (types.length > 0) {
            options.push({
                type: 'select',
                id: 'type-option',
                label: 'Choose Type',
                options: types,
                required: true
            });
        }
    }

    if (product.shapeOptions) {
        const shapes = product.shapeOptions.split(',').map(s => s.trim()).filter(Boolean);
        if (shapes.length > 0) {
            options.push({
                type: 'select',
                id: 'shape-option',
                label: 'Choose Shape',
                options: shapes,
                required: true
            });
        }
    }

    if (options.length > 0) {
        section.style.display = 'block';
        container.innerHTML = options.map(option => `
            <div class="option-group">
                <label for="${option.id}">${option.label}:</label>
                <select id="${option.id}" class="option-selector" ${option.required ? 'required' : ''}>
                    <option value="">-- Select ${option.label} --</option>
                    ${option.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                </select>
            </div>
        `).join('');
    } else {
        section.style.display = 'none';
    }
}

// NEW: Render bundle items
function renderBundleItems(product) {
    const section = document.getElementById('bundle-items-section');
    const container = document.getElementById('bundle-items-container');
    
    if (!section || !container) return;

    const bundleItems = product.bundleItems || [];
    
    if (bundleItems.length > 0) {
        section.style.display = 'block';
        container.innerHTML = `
            <p class="customization-prompt product-name-bold">Choose your scents for each item:</p>
            ${bundleItems.map((item, i) => {
                const scentOptionsArray = (item.allowedScents || '').split(',').map(s => s.trim()).filter(Boolean);
                const scentOptions = scentOptionsArray.map(scent => `<option value="${scent}">${scent}</option>`).join('');
                const bundleItemName = `${item.subProductName || 'Item'} (${item.size || 'Size N/A'})`;
                
                return `
                    <div class="bundle-selector-group">
                        <label for="bundle-scent-${i}">${bundleItemName}:</label>
                        <select id="bundle-scent-${i}" class="scent-selector" required>
                            <option value="">-- Select a scent --</option>
                            ${scentOptions}
                        </select>
                    </div>
                `;
            }).join('')}
        `;
    } else {
        section.style.display = 'none';
    }
}

// NEW: Buy Now Button Functionality
function setupBuyNowButton(product) {
    const buyNowBtn = document.querySelector('.buy-it-now-btn');
    if (!buyNowBtn) return;

    buyNowBtn.addEventListener('click', (e) => {
        const quantity = parseInt(document.getElementById('quantity')?.value || 1);
        const customization = collectAllSelections(product);

        if (customization === null) return; // Validation failed

        const itemName = product.isBundle ? product.bundleName : product.name_en;
        const itemPrice = product.price_egp || product.price || 0;

        const item = {
      _     _id: product._id,
            name: itemName || product.name || 'Product',
            price: itemPrice,
            quantity: quantity,
            // *** FIXED: Only add customization if the array is not empty ***
            customization: customization.length > 0 ? customization : null,
            imageUrl: product.imagePaths?.[0] || product.images?.[0] || 'images/placeholder.jpg'
        };

        // ADD the item to cart (don't clear existing items)
        addToCart(item);
        
        // Redirect to checkout
        window.location.href = 'checkout.html';
    });
}

function attachQuantityButtonListeners(maxStock) {
    const quantityInput = document.getElementById('quantity');
    if (!quantityInput) return;

    document.querySelector('.quantity-minus')?.addEventListener('click', () => {
        let currentVal = parseInt(quantityInput.value);
        if (currentVal > 1) {
            quantityInput.value = currentVal - 1;
        }
    });

    document.querySelector('.quantity-plus')?.addEventListener('click', () => {
        let currentVal = parseInt(quantityInput.value);
        if (currentVal < (maxStock || 10)) {
            quantityInput.value = currentVal + 1;
        }
    });
}

function attachAddToCartListener(product) {
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    const quantityInput = document.getElementById('quantity');

    if (!addToCartBtn || !quantityInput) {
        return;
    }

    addToCartBtn.addEventListener('click', (e) => {
        const quantity = parseInt(quantityInput.value);
        const customization = collectAllSelections(product);

        if (customization === null) return; // Validation failed

        const itemName = product.isBundle ? product.bundleName : product.name_en;
        const itemPrice = product.price_egp || product.price || 0;

        const item = {
            _id: product._id,
            name: itemName || product.name || 'Product',
            price: itemPrice,
            quantity: quantity,
            // *** FIXED: Only add customization if the array is not empty ***
            customization: customization.length > 0 ? customization : null,
            imageUrl: product.imagePaths?.[0] || product.images?.[0] || 'images/placeholder.jpg'
        };
        addToCart(item);
    });
}

// NEW: Collect all selections from options and bundle items
function collectAllSelections(product) {
    const selections = [];
    let validationFailed = false; // Add a flag

    // Collect from product options
    const optionSelectors = [
        'scent-option', 'size-option', 'weight-option', 'type-option', 'shape-option'
    ];

    optionSelectors.forEach(selectorId => {
        const selector = document.getElementById(selectorId);
        if (selector) {
            // Check if it's required AND has no value
            if (selector.required && !selector.value) {
                console.error(`Please select a value for ${selectorId}`);
                selector.focus();
                validationFailed = true;
            } else if (selector.value) {
                selections.push(`${selectorId.replace('-option', '')}: ${selector.value}`);
            }
        }
    });

    // If any required option failed, return null
    if (validationFailed) return null;

    // Collect from bundle items if it's a bundle
    if (product.isBundle) {
        const bundleItems = product.bundleItems || [];
        const bundleSelections = [];
        let allSelected = true;

        for (let i = 0; i < bundleItems.length; i++) {
            const selector = document.getElementById(`bundle-scent-${i}`);
            if (!selector || !selector.value) {
                console.error(`Please choose a scent for Item ${i + 1}.`);
                selector?.focus();
                allSelected = false;
                break;
            }
            bundleSelections.push(selector.value);
        }

        if (!allSelected) return null;
        selections.push(...bundleSelections);
    }

    // *** THIS IS THE FIX ***
    // Always return the array, even if it's empty.
    // Do not return null if length is 0.
    return selections;
}

// ====================================
// 8. CART MANAGEMENT (FIXED - ALL ISSUES RESOLVED)
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

// FIXED: Improved cart ID generation for bundles
function getCartUniqueId(product) {
    if (product.customization && product.customization.length > 0) {
        // For bundles, include all customization options in the ID
        const customizationString = Array.isArray(product.customization) 
            ? product.customization.sort().join('|')
            : product.customization;
        return `${product._id}_${customizationString}`;
    }
    return product._id;
}

function addToCart(product) {
    const uniqueId = getCartUniqueId(product);
    const existingItem = cart.find(item => getCartUniqueId(item) === uniqueId);
    
    if (existingItem) {
        existingItem.quantity += product.quantity || 1;
    } else {
        cart.push({ 
            ...product, 
            cartItemId: uniqueId, 
            quantity: product.quantity || 1 
        });
    }
    saveCartToStorage();
    updateCartUI();
    
    // Show success message
    showCartMessage(`${product.name} (x${product.quantity || 1}) added to cart!`);
}
// Make addToCart globally available
window.addToCart = addToCart;

// FIXED: Remove item function with proper ID handling
function removeItemFromCart(id) {
    cart = cart.filter(item => getCartUniqueId(item) !== id);
    saveCartToStorage();
    updateCartUI();
    
    const page = document.body.getAttribute('data-page');
    if (page === 'shopcart') {
        renderShopCartPage();
    } else if (page === 'checkout') {
        renderCheckoutSummary(document.getElementById('checkout-summary-container'));
        renderCheckoutCartItems();
        // Hide form if cart becomes empty
        if (cart.length === 0) {
            const checkoutForm = document.getElementById('checkout-form');
            if (checkoutForm) checkoutForm.style.display = 'none';
        }
    }
    
    // Show removal message
    showCartMessage('Item removed from cart');
}
// Make removeItemFromCart globally available
window.removeItemFromCart = removeItemFromCart;

// FIXED: Update item quantity with proper validation
function updateItemQuantity(id, quantity) {
    const item = cart.find(item => getCartUniqueId(item) === id);
    if (item) {
        const newQuantity = parseInt(quantity);
        if (newQuantity > 0 && !isNaN(newQuantity)) {
            item.quantity = newQuantity;
            saveCartToStorage();
            updateCartUI();
            
            // Update both shopcart and checkout pages if they're active
          _ if (document.body.getAttribute('data-page') === 'shopcart') {
                renderShopCartPage();
            } else if (document.body.getAttribute('data-page') === 'checkout') {
                renderCheckoutSummary(document.getElementById('checkout-summary-container'));
                renderCheckoutCartItems();
            }
        } else if (newQuantity <= 0) {
            removeItemFromCart(id);
        }
    }
}
// Make updateItemQuantity globally available
window.updateItemQuantity = updateItemQuantity;

function getCartTotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

// FIXED: Update cart UI with proper event delegation
function updateCartUI() {
    const cartCountElement = document.querySelector('.cart-count');
    const cartListElement = document.querySelector('.cart-items-list');
    const cartTotalElement = document.getElementById('cart-total');
    
    if (!cartCountElement || !cartTotalElement) return;

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = getCartTotal();
    
    // Update cart counter
    if (totalItems === 0) {
        cartCountElement.style.visibility = 'hidden'; 
        cartCountElement.style.opacity = 0;
    } else {
        cartCountElement.style.visibility = 'visible'; 
        cartCountElement.style.opacity = 1;
        cartCountElement.textContent = totalItems;
    }
    
    // Update cart total in dropdown
    cartTotalElement.textContent = `${totalPrice.toFixed(2)} EGP`;
    
    // Update cart items list in dropdown WITH QUANTITY CONTROLS
    if (cartListElement) {
        if (cart.length === 0) {
            cartListElement.innerHTML = '<p class="empty-cart-message">Your cart is empty.</p>';
        } else {
            cartListElement.innerHTML = cart.map(item => {
                const uniqueId = getCartUniqueId(item);
                const customizationDetail = item.customization ? 
                    `<div class="cart-customization-detail">${item.customization.slice(0, 2).join(', ')}${item.customization.length > 2 ? '...' : ''}</div>` 
                    : '';
                const itemTotal = (item.price * item.quantity).toFixed(2);
                
                return `
                    <div class="cart-item" data-id="${uniqueId}">
                        <div class="cart-item-details">
                            <p class="cart-item-name">${item.name}</p>
                            <p class="cart-item-total">${itemTotal} EGP</p>
                        </div>
                        ${customizationDetail}
                        <div class="cart-item-controls">
                            <div class="quantity-controls">
                                <button class="quantity-btn minus" onclick="updateItemQuantity('${uniqueId}', ${item.quantity - 1})">-</button>
                                <input type="number" value="${item.quantity}" min="1" class="item-quantity-input" 
                                       onchange="updateItemQuantity('${uniqueId}', this.value)">
normal                           <button class="quantity-btn plus" onclick="updateItemQuantity('${uniqueId}', ${item.quantity + 1})">+</button>
                            </div>
                            <button class="remove-item-btn" onclick="removeItemFromCart('${uniqueId}')" aria-label="Remove item">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
  _             `;
            }).join('');
        }
    }
}

// FIXED: Cart message function
function showCartMessage(message) {
    // Remove existing message if any
    const existingMessage = document.querySelector('.cart-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create new message
    const messageElement = document.createElement('div');
    messageElement.className = 'cart-message';
    messageElement.textContent = message;
    messageElement.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: var(--accent-color);
        color: white;
        padding: 12px 20px;
        border-radius: 5px;
        z-index: 10000;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(messageElement);
    
    // Remove message after 3 seconds
    setTimeout(() => {
        messageElement.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.remove();
            }
        }, 300);
    }, 3000);
}

// ====================================
// 9. SHOP CART PAGE LOGIC (FIXED)
// ====================================

function renderShopCartPage() {
    const itemsContainer = document.getElementById('cart-items-table');
    const summaryContainer = document.getElementById('cart-summary');
    
    if (!itemsContainer || !summaryContainer) return;

    if (cart.length === 0) {
        itemsContainer.innerHTML = '<tr><td colspan="5" class="empty-cart-message-full">Your cart is empty. <a href="products.html">Start Shopping!</a></td></tr>';
        summaryContainer.innerHTML = '';
        const checkoutLink = document.getElementById('checkout-link-bottom');
        if (checkoutLink) checkoutLink.style.display = 'none';
        return;
    }

    // Render Items Table with proper data attributes
    itemsContainer.innerHTML = cart.map(item => {
        const uniqueId = getCartUniqueId(item);
        const customizationDetail = item.customization ? 
            `<div class="cart-customization-detail"><small>Options: ${item.customization.join(', ')}</small></div>` 
            : '';
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
                    <div class="quantity-controls">
                        <button class="quantity-btn minus" onclick="updateItemQuantity('${uniqueId}', ${item.quantity - 1})">-</button>
                        <input type="number" value="${item.quantity}" min="1" class="item-quantity-input" 
                               onchange="updateItemQuantity('${uniqueId}', this.value)">
                        <button class="quantity-btn plus" onclick="updateItemQuantity('${uniqueId}', ${item.quantity + 1})">+</button>
                    </div>
                </td>
                <td data-label="Total">${(item.price * item.quantity).toFixed(2)} EGP</td>
Note             <td data-label="Remove">
                    <button class="remove-item-btn" onclick="removeItemFromCart('${uniqueId}')" aria-label="Remove item">
                        <i class="fas fa-times"></i>
                    </button>
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
        <p>Shipping (Egypt): <span>${shipping === 0 ? 'FREE' : shipping.toFixed(2) + ' EGP'}</span></p>
        <p class="cart-total-final">Grand Total: <span>${grandTotal.toFixed(2)} EGP</span></p>
        <a href="checkout.html" class="checkout-btn">Proceed to Checkout</a>
    `;
    
    const checkoutLink = document.getElementById('checkout-link-bottom');
    if (checkoutLink) checkoutLink.style.display = 'block';
}

// ====================================
// 10. CHECKOUT PAGE LOGIC (FIXED)
// ====================================

function setupCheckoutPage() {
    const summaryContainer = document.getElementById('checkout-summary-container');
    const checkoutForm = document.getElementById('checkout-form');
    const cartItemsContainer = document.getElementById('checkout-cart-items');
    
    if (cart.length === 0) {
        summaryContainer.innerHTML = '<p>Your cart is empty. <a href="products.html">Return to shopping.</a></p>';
        if (checkoutForm) checkoutForm.style.display = 'none';
        if (cartItemsContainer) cartItemsContainer.innerHTML = '<p class="empty-message">Your cart is empty.</p>';
        return;
    }
    
    renderCheckoutSummary(summaryContainer);
    renderCheckoutCartItems();
    
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

// FIXED: Checkout cart items with working quantity controls
function renderCheckoutCartItems() {
    const container = document.getElementById('checkout-cart-items');
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = '<p class="empty-message">Your cart is empty.</p>';
        return;
    }

    container.innerHTML = cart.map(item => {
        const uniqueId = getCartUniqueId(item);
        const customizationDetail = item.customization ? 
            `<div class="cart-customization-detail"><small>Options: ${item.customization.join(', ')}</small></div>` 
            : '';
        const itemImage = item.imageUrl || 'images/placeholder.jpg';
        const itemTotal = (item.price * item.quantity).toFixed(2);

        return `
            <div class="checkout-cart-item" data-id="${uniqueId}">
                <div class="checkout-item-image">
                    <img src="${itemImage}" alt="${item.name}" loading="lazy">
                </div>
                <div class="checkout-item-details">
                    <h4>${item.name}</h4>
                    ${customizationDetail}
                    <div class="checkout-item-price">${item.price.toFixed(2)} EGP each</div>
                </div>
                <div class="checkout-item-controls">
                    <div class="quantity-controls">
                        <button class="quantity-btn minus" onclick="updateItemQuantity('${uniqueId}', ${item.quantity - 1})">-</button>
                        <input type="number" value="${item.quantity}" min="1" class="item-quantity-input" 
                               onchange="updateItemQuantity('${uniqueId}', this.value)">
                        <button class="quantity-btn plus" onclick="updateItemQuantity('${uniqueId}', ${item.quantity + 1})">+</button>
                    </div>
                    <div class="checkout-item-total">${itemTotal} EGP</div>
                    <button class="remove-item-btn" onclick="removeItemFromCart('${uniqueId}')" aria-label="Remove item">
                </td>
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
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
            productId: item._id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            customization: item.customization || null
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
        const response = await fetch(`${API_BASE_URL}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();

        if (response.ok) {
            console.log('Order placed successfully! Your Order ID is: ' + result.orderId);
            cart = []; 
            saveCartToStorage();
            updateCartUI();
            window.location.href = 'index.html'; 
        } else {
            throw new Error(result.message || 'Failed to place order.');
        }

    } catch (error) {
        console.error('Order failed: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Place Order';
    }
}