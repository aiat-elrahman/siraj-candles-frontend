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
                        <option value="Diffusers" ${currentCategory === 'Diffusers' ? 'selected' : ''}>Diffusers</option>
                        <option value="Soaps" ${currentCategory === 'Soaps' ? 'selected' : ''}>Soaps</option>
                        <option value="Bundles" ${currentCategory === 'Bundles' ? 'selected' : ''}>Bundles</option>
                        <option value="Body care" ${currentCategory === 'Body care' ? 'selected' : ''}>Body care</option>
                        <option value="Freshener" ${currentCategory === 'Freshener' ? 'selected' : ''}>Freshener</option>
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
// 7. SINGLE PRODUCT/BUNDLE LOGIC (FIXED)
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

// FIXED: Product rendering function (removed related products from this function)
function renderProduct(product) {
    const container = document.getElementById('product-detail-container');
    if (!container) return;

    const isBundle = product.isBundle;
    const itemName = isBundle ? product.bundleName : product.name_en;
    const itemPrice = product.price_egp || product.price || 0;
    const itemCategory = product.category || 'N/A';
    const itemStock = product.stock || 0;
    const isOutOfStock = itemStock <= 0;

    // Attributes
    const attributes = [];
    if (!isBundle) {
        if (product.scents) attributes.push({ label: 'Scent', value: product.scents ?? 'N/A', icon: '🌸' });
        if (product.size) attributes.push({ label: 'Size', value: product.size ?? 'N/A', icon: '📏' });
        if (product.burnTime) attributes.push({ label: 'Burn Time', value: product.burnTime ?? 'N/A', icon: '🔥' });
        if (product.wickType) attributes.push({ label: 'Wick', value: product.wickType ?? 'N/A', icon: '🧵' });
        if (product.coverageSpace) attributes.push({ label: 'Coverage', value: product.coverageSpace ?? 'N/A', icon: '🏠' });
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

    // Bundle Customization
    let customizationHTML = '';
    const bundleItems = product.bundleItems || [];
    const numItemsInBundle = bundleItems.length;
    if (isBundle && numItemsInBundle > 0) {
        let bundleSelectors = `<p class="customization-prompt product-name-bold">Choose your scents for each item:</p>`;
        bundleItems.forEach((item, i) => {
            const scentOptionsArray = (item.allowedScents || '').split(',').map(s => s.trim()).filter(Boolean);
            const scentOptions = scentOptionsArray.map(scent => `<option value="${scent}">${scent}</option>`).join('');
            const bundleItemName = `${item.subProductName || 'Item'} (${item.size || 'Size N/A'})`;
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
        customizationHTML = `<div class="bundle-customization-section">${bundleSelectors}</div>`;
    }

    // Update Meta Description & Title
    document.title = `${itemName || 'Product'} | Siraj Candles`;
    const metaDesc = (shortDescription || '').substring(0, 150).replace(/<br>/g, ' ');
    document.querySelector('meta[name="description"]')?.setAttribute('content', metaDesc + (metaDesc.length === 150 ? '...' : ''));

    // FIXED: Only render main product details, NOT related products
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
                        <button id="add-to-cart-btn" class="action-add-to-cart-btn"
                                data-is-bundle="${isBundle}" data-bundle-items="${numItemsInBundle}">
                            <span class="cart-icon" aria-hidden="true">🛒</span> Add to Cart
                        </button>
                        <button class="buy-it-now-btn action-buy-now-btn">Buy it Now</button>
                    </div>
                ` : `
                    <p class="stock-status out-of-stock">Out of Stock</p>
                    <button class="action-add-to-cart-btn out-of-stock-btn" disabled>Notify Me When Available</button>
                `}

                ${customizationHTML}

                <div class="product-description-section">
                     <h3 class="section-subtitle">Description</h3> 
                     ${shortDescription ? `<p>${shortDescription.replace(/\r?\n/g, '<br>')}</p>` : '<p>No description provided.</p>'}
                     ${formattedDescriptionHTML} 
                </div>

                ${attributes.length > 0 ? `
                    <div class="product-attributes-section"> 
                        <h3 class="section-subtitle">Details</h3> 
                        <div class="product-attributes-grid">
                            ${attributes.map(attr => `
                                <div class="attribute-chip">
                                    <span class="attribute-icon" aria-hidden="true">${attr.icon || '🔹'}</span>
                                    <span class="attribute-label">${attr.label}:</span>
                                    <span class="attribute-value">${attr.value}</span>
                                </div>
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

    attachQuantityButtonListeners(itemStock);
    attachAddToCartListener(product);
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
        const isBundleBtn = e.currentTarget.getAttribute('data-is-bundle') === 'true';
        const numItemsInBundle = parseInt(e.currentTarget.getAttribute('data-bundle-items') || '0');
        const quantity = parseInt(quantityInput.value);

        let customization = null;
        if (isBundleBtn && numItemsInBundle > 0) {
            customization = collectBundleScents(numItemsInBundle);
            if (!customization) return;
        }

        const itemName = isBundleBtn ? product.bundleName : product.name_en;
        const itemPrice = product.price_egp || product.price || 0;

        const item = {
            _id: product._id,
            name: itemName || product.name || 'Product',
            price: itemPrice,
            quantity: quantity,
            customization: customization,
            imageUrl: product.imagePaths?.[0] || product.images?.[0] || 'images/placeholder.jpg'
        };
        addToCart(item);
    });
}

function collectBundleScents(numItems) {
    const scents = [];
    let allSelected = true;
    for (let i = 0; i < numItems; i++) {
        const selector = document.getElementById(`scent-${i}`);
        if (!selector || !selector.value) {
            console.error(`Please choose a scent for Item ${i + 1}.`);
            selector?.focus();
            allSelected = false;
            break;
        }
        scents.push(selector.value);
    }
    return allSelected ? scents : null;
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
    console.log(`${product.name} (x${product.quantity || 1}) added to cart!`);
}
window.addToCart = addToCart;

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
        if (newQuantity > 0 && !isNaN(newQuantity)) {
            item.quantity = newQuantity;
            saveCartToStorage();
            updateCartUI();
            if (document.body.getAttribute('data-page') === 'shopcart') {
                renderShopCartPage();
            }
        } else if (newQuantity <= 0) {
            removeItemFromCart(id);
        }
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
        const checkoutLink = document.getElementById('checkout-link-bottom');
        if (checkoutLink) checkoutLink.style.display = 'none';
        return;
    }

    // Render Items Table with proper data attributes
    itemsContainer.innerHTML = cart.map(item => {
        const uniqueId = getCartUniqueId(item);
        const customizationDetail = item.customization ? 
            `<div class="cart-customization-detail"><small>Scents: ${item.customization.join(', ')}</small></div>` 
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
                    <input type="number" value="${item.quantity}" min="1" class="item-quantity-input" 
                           onchange="updateItemQuantity('${uniqueId}', this.value)">
                </td>
                <td data-label="Total">${(item.price * item.quantity).toFixed(2)} EGP</td>
                <td data-label="Remove">
                    <button class="remove-item-btn" onclick="removeItemFromCart('${uniqueId}')">
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
        <p>Shipping (Egypt): <span>${shipping.toFixed(2)} EGP</span></p>
        <p class="cart-total-final">Grand Total: <span>${grandTotal.toFixed(2)} EGP</span></p>
        <a href="checkout.html" class="checkout-btn">Proceed to Checkout</a>
    `;
    
    const checkoutLink = document.getElementById('checkout-link-bottom');
    if (checkoutLink) checkoutLink.style.display = 'block';
}

// ====================================
// 10. CHECKOUT PAGE LOGIC
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