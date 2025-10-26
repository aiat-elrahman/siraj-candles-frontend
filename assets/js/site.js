const API_BASE_URL = 'https://siraj-backend.onrender.com';
const ITEMS_PER_PAGE = 12;

// ====================================
// 1. DOM & INITIALIZATION
// ====================================
// (Keep existing DOM selections: searchToggle, cartToggle, etc.)

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadCartFromStorage(); // Load cart data first

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
            loadProductDetails(); // This function now handles the complex rendering
            break;
        case 'shopcart':
            renderShopCartPage();
            break;
        case 'checkout':
            setupCheckoutPage();
            break;
    }
});

function setupEventListeners() {
    // Keep existing event listener setup for search, cart dropdown etc.
    // Ensure quantity button listeners are added within renderProduct
}

// ====================================
// 2. UNIVERSAL FETCHING & UTILS
// ====================================

async function fetchGridData(endpoint, page = 1, limit = ITEMS_PER_PAGE, query = '') {
    // Keep existing fetchGridData function
    try {
        const fullUrl = `${API_BASE_URL}/api${endpoint}?page=${page}&limit=${limit}${query}`;
        const response = await fetch(fullUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        const items = result.results || []; // Use results key from updated backend

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

// --- UPDATED: Minimalist Product Card Rendering ---
function renderProductGrid(containerId, items, endpointType) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items || items.length === 0) { // Added check for undefined items
        container.innerHTML = `<p class="no-products-message">No ${endpointType} found at this time.</p>`;
        return;
    }

    container.innerHTML = items.map(item => {
        const isBundle = item.productType === 'Bundle';
        // Use generic name field first, then fallbacks
        const itemName = item.name || item.name_en || item.bundleName || 'Unknown Product';
        const itemPrice = item.price_egp || item.price || 0; // Use price_egp primarily
        const itemImage = item.imagePaths?.[0] || item.images?.[0] || 'images/placeholder.jpg'; // Use imagePaths first

        // Link the whole card
        return `
            <a href="product.html?id=${item._id}" class="product-card">
                <img src="${itemImage}" alt="${itemName}" loading="lazy"> {/* Added lazy loading */}
                <div class="product-info-minimal">
                    <p class="product-title">${itemName}</p>
                    <p class="product-price">${(itemPrice).toFixed(2)} EGP</p>
                    {/* Add stars/reviews here later if needed */}
                </div>
            </a>
        `;
    }).join('');
}


function renderPagination(controlsId, totalPages, currentPage, pageFile, loadFunction) {
    // Keep existing renderPagination function
}

function debounce(func, delay) {
    // Keep existing debounce function
}

// ====================================
// 3. HOMEPAGE LOGIC
// ====================================

async function fetchAndrenderCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;
    container.innerHTML = '<p>Loading categories...</p>';

    try {
        // Fetch a reasonable number of products to extract categories
        const { items } = await fetchGridData('/products', 1, 100); // Fetch fewer items

        if (items.length === 0) { /* ... keep existing empty message ... */ return; }

        const uniqueCategories = new Map(); // Use a Map to store name and maybe an image later
        items.forEach(item => {
            if (item.category && !uniqueCategories.has(item.category)) {
                // For now, just store the name. Later, you could add logic to find a representative image.
                uniqueCategories.set(item.category, { name: item.category, image: 'images/placeholder-category.jpg' });
            }
        });

        const categoriesArray = Array.from(uniqueCategories.values());

        if (categoriesArray.length === 0) { /* ... keep existing empty message ... */ return; }

        // Render category cards (Consider adding image logic here later)
        container.innerHTML = categoriesArray.map(cat => {
            const imageSrc = cat.name.toLowerCase().includes('candle') ? 'images/placeholder-candle.jpg' : 'images/placeholder-freshener.jpg'; // Basic placeholder
            return `
                <a href="products.html?category=${encodeURIComponent(cat.name)}" class="category-card-item">
                    {/* Add image element if you have category images */}
                    {/* <img src="${imageSrc}" alt="${cat.name}" class="category-image"> */}
                    <div class="category-info">
                        <p class="category-name">${cat.name}</p>
                        {/* Maybe an arrow icon */}
                    </div>
                </a>
            `;
        }).join('');

    } catch (error) { /* ... keep existing error handling ... */ }
}


async function fetchBestsellers() {
    const container = document.getElementById('bestsellers-container');
    if (!container) return;
    container.innerHTML = '<p>Loading bestsellers...</p>';
    try {
        // Fetch featured products using the correct query param
        const { items } = await fetchGridData('/products', 1, 6, '&featured=true'); // Use 'featured' based on schema
        renderProductGrid('bestsellers-container', items, 'bestsellers'); // Pass 'bestsellers' type
    } catch (error) { /* ... keep existing error handling ... */ }
}

// ====================================
// 4. SEARCH LOGIC
// ====================================
async function handleSearch() {
    // Keep existing handleSearch function
}

// ====================================
// 5. PRODUCTS GRID PAGE LOGIC
// ====================================
function initProductsPage() {
    // Keep existing initProductsPage function
}
function renderFilterSortBar() {
    // Keep existing renderFilterSortBar function
}
async function loadProducts(page) {
    // Keep existing loadProducts function
}

// ====================================
// 6. BUNDLES GRID PAGE LOGIC
// ====================================
function initBundlesPage() {
    // Keep existing initBundlesPage function
}
async function loadBundles(page) {
    // Keep existing loadBundles function
}

// ====================================
// 7. SINGLE PRODUCT/BUNDLE LOGIC (MAJOR OVERHAUL)
// ====================================

async function loadProductDetails() {
    const container = document.getElementById('product-detail-container');
    if (!container) { console.error("Product detail container not found"); return; }
    container.innerHTML = '<p class="loading-message">Loading product details...</p>'; // Loading state

    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (!id) { container.innerHTML = '<p class="error-message">No product ID found in URL.</p>'; return; }

    const endpoint = `/api/products/${id}`;
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) {
             const errorData = await response.json(); // Try to get error message from backend
            throw new Error(`HTTP error! status: ${response.status} - ${errorData.message || 'Not Found'}`);
        }
        const product = await response.json();
        product.isBundle = product.productType === 'Bundle'; // Add helper flag

        renderProduct(product); // Call the updated render function

        // Fetch related products (only if needed)
        const relatedContainer = document.getElementById('related-products-container');
        if (relatedContainer) {
            fetchRelatedProducts(product.category || 'general', product._id);
        } else {
             console.warn("Related products container not found on this page.");
        }

    } catch (error) {
        console.error(`Error fetching product details for ID ${id}:`, error);
        container.innerHTML = `<p class="error-message">Could not load product details. ${error.message}. Please try again later.</p>`;
    }
}

// --- UPDATED: Poshmark-inspired Product Detail Rendering ---
function renderProduct(product) {
    const container = document.getElementById('product-detail-container');
    if (!container) return;

    // --- Extract Data ---
    const isBundle = product.isBundle;
    const itemName = isBundle ? product.bundleName : product.name_en; // Use specific names
    const itemPrice = product.price_egp || product.price || 0;
    const itemCategory = product.category || 'N/A';
    const itemStock = product.stock || 0;
    const isOutOfStock = itemStock <= 0;

    // Attributes (Prepare data for icon display)
    const attributes = [];
    if (!isBundle) {
        if (product.scents) attributes.push({ label: 'Scent', value: product.scents, icon: '🌸' }); // Example icon
        if (product.size) attributes.push({ label: 'Size', value: product.size, icon: '📏' });
        if (product.burnTime) attributes.push({ label: 'Burn Time', value: product.burnTime, icon: '🔥' });
        if (product.wickType) attributes.push({ label: 'Wick', value: product.wickType, icon: '🧵' });
        if (product.coverageSpace) attributes.push({ label: 'Coverage', value: product.coverageSpace, icon: '🏠' });
        // Add more attributes like Jar Specs, Candle Care if they exist in your product data
    }

    // Descriptions
    const shortDescription = isBundle ? product.bundleDescription : product.description_en;
    const formattedDescriptionHTML = product.formattedDescription
        ? `<div class="formatted-description-box">${product.formattedDescription.replace(/\r?\n/g, '<br>')}</div>`
        : ''; // Use only if single product and exists

    // Image Gallery
    const imageGalleryHTML = (product.imagePaths || product.images || [])
        .map((path, index) => `<img src="${path}" alt="${itemName} image ${index + 1}" class="${index === 0 ? 'main-product-image' : 'thumbnail-image'}" loading="lazy">`)
        .join('');

    // Bundle Customization (Keep existing logic, ensure it targets correct IDs if needed)
    let customizationHTML = '';
    if (isBundle && product.bundleItems && product.bundleItems.length > 0) {
        // ... (Keep your existing bundleItems.forEach loop to build bundleSelectors HTML) ...
        // Ensure the class names match the CSS: .bundle-customization-section, .bundle-selector-group etc.
         customizationHTML = `<div class="bundle-customization-section"> ... ${bundleSelectors} ... </div>`;
    }

    // --- Build HTML ---
    container.innerHTML = `
        <div class="product-detail-grid-new"> {/* Use new class for layout */}
            
            {/* Column 1: Image Gallery */}
            <div class="product-image-area-new">
                <div class="image-gallery">
                    ${imageGalleryHTML || '<img src="images/placeholder.jpg" alt="Placeholder" class="main-product-image">'}
                </div>
            </div>

            {/* Column 2: Product Info & Actions */}
            <div class="product-info-area-new">
                
                {/* Info Block 1: Title, Category, Price */}
                <h1 class="product-title-main">${itemName || 'Product Name'}</h1>
                <p class="product-category-subtle">${itemCategory}</p> {/* Category below title */}
                <p class="product-price-main">${itemPrice.toFixed(2)} EGP</p>

                {/* Info Block 2: Action Buttons */}
                ${!isOutOfStock ? `
                    <div class="product-actions-grid">
                        <div class="quantity-selector-box">
                            <button class="quantity-minus action-btn" data-action="minus">-</button>
                            <input type="number" id="quantity" value="1" min="1" max="${itemStock || 10}" readonly class="quantity-input-box">
                            <button class="quantity-plus action-btn" data-action="plus">+</button>
                        </div>
                        <button id="add-to-cart-btn" class="action-add-to-cart-btn" 
                                data-is-bundle="${isBundle}" data-bundle-items="${product.bundleItems?.length || 0}">
                            <span class="cart-icon">🛒</span> Add to Cart
                        </button>
                        <button class="buy-it-now-btn action-buy-now-btn">Buy it Now</button>
                    </div>
                ` : `
                    <p class="stock-status out-of-stock">Out of Stock</p>
                    <button class="action-add-to-cart-btn out-of-stock-btn" disabled>Notify Me When Available</button>
                `}
                
                {/* Bundle Customization (If applicable) */}
                ${customizationHTML}

                {/* Info Block 3: Description */}
                <div class="product-description-section">
                     ${shortDescription ? `<p>${shortDescription.replace(/\r?\n/g, '<br>')}</p>` : '<p>No description provided.</p>'}
                     ${formattedDescriptionHTML} {/* Display only if single product and has content */}
                </div>

                {/* Info Block 4: Attributes (Icon/Tag style) */}
                ${attributes.length > 0 ? `
                    <div class="product-attributes-grid">
                        ${attributes.map(attr => `
                            <div class="attribute-chip">
                                <span class="attribute-icon">${attr.icon || '🔹'}</span> {/* Default icon */}
                                <span class="attribute-label">${attr.label}:</span>
                                <span class="attribute-value">${attr.value}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                {/* Info Block 5: Stock Status (If not already shown) */}
                ${isOutOfStock ? '' : '<p class="stock-status in-stock">In Stock</p>'}

                 {/* Shipping Info - Moved to bottom */}
                 <div class="shipping-returns-new">
                     <h3>Shipping & Returns</h3>
                     <ul>
                         <li>Orders processed within 1–2 business days.</li>
                         <li>Delivery across Egypt within 2–5 days.</li>
                         <li>Returns accepted within 7 days for unused items.</li>
                     </ul>
                 </div>

            </div> {/* End product-info-area-new */}
        </div> {/* End product-detail-grid-new */}

        {/* Related Products Section (Keep only the one at the bottom) */}
        <div class="related-products-section" id="related-products-main"> {/* Ensure unique ID if needed */}
             <h3>Other Products You Might Like</h3>
             <div id="related-products-container" class="product-grid related-grid">
                 {/* Products will be loaded here by fetchRelatedProducts */}
             </div>
        </div>
    `;

    // --- Add Event Listeners AFTER setting innerHTML ---
    attachQuantityButtonListeners(itemStock); // Attach listeners for +/- buttons
    attachAddToCartListener(product);      // Attach listener for Add to Cart button
    // Attach Buy Now listener if needed
    // document.querySelector('.buy-it-now-btn')?.addEventListener('click', () => { /* Add Buy Now logic */ });
}

// --- Helper: Attach Quantity Button Listeners ---
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
        if (currentVal < (maxStock || 10)) { // Use actual max stock
            quantityInput.value = currentVal + 1;
        }
    });
}

// --- Helper: Attach Add to Cart Listener ---
function attachAddToCartListener(product) {
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    const quantityInput = document.getElementById('quantity');

    if (!addToCartBtn || !quantityInput) return;

    addToCartBtn.addEventListener('click', (e) => {
        const isBundleBtn = e.currentTarget.getAttribute('data-is-bundle') === 'true';
        const numItemsInBundle = parseInt(e.currentTarget.getAttribute('data-bundle-items') || '0');
        const quantity = parseInt(quantityInput.value);

        let customization = null;
        if (isBundleBtn && numItemsInBundle > 0) {
            customization = collectBundleScents(numItemsInBundle);
            if (!customization) return; // Stop if scents not selected
        }

        const itemName = isBundleBtn ? product.bundleName : product.name_en;
        const itemPrice = product.price_egp || product.price || 0;

        const item = {
            _id: product._id,
            name: itemName,
            price: itemPrice,
            quantity: quantity,
            customization: customization,
            imageUrl: product.imagePaths?.[0] || product.images?.[0] || 'images/placeholder.jpg'
        };
        addToCart(item); // Call global addToCart function
    });
}


function collectBundleScents(numItems) {
    // Keep existing collectBundleScents function
}

async function fetchRelatedProducts(category, excludeId) {
    const container = document.getElementById('related-products-container');
    if (!container) return; // Only run if the container exists
    container.innerHTML = '<p>Loading related products...</p>';
    try {
        const query = `&category=${category}&limit=4&exclude_id=${excludeId}&status=Active`; // Fetch 4 active products
        const { items } = await fetchGridData('/products', 1, 4, query);
        renderProductGrid('related-products-container', items, 'related products'); // Use correct render function
    } catch (error) {
        container.innerHTML = '<p class="error-message">Could not load related products.</p>';
    }
}


// ====================================
// 8. CART MANAGEMENT (with Counter Fix)
// ====================================
let cart = [];

function loadCartFromStorage() {
    // Keep existing loadCartFromStorage function
}
function saveCartToStorage() {
    // Keep existing saveCartToStorage function
}
function getCartUniqueId(product) {
    // Keep existing getCartUniqueId function
}
function addToCart(product) {
    // Keep existing addToCart function
}
window.addToCart = addToCart;

function removeItemFromCart(id) {
    // Keep existing removeItemFromCart function
}
window.removeItemFromCart = removeItemFromCart;

function updateItemQuantity(id, quantity) {
    // Keep existing updateItemQuantity function
}
window.updateItemQuantity = updateItemQuantity;

function getCartTotal() {
    // Keep existing getCartTotal function
}

// --- UPDATED: Cart Counter Visibility ---
function updateCartUI() {
    const cartCountElement = document.querySelector('.cart-count');
    const cartListElement = document.querySelector('.cart-items-list'); // In dropdown
    const cartTotalElement = document.getElementById('cart-total');   // In dropdown

    // Update Cart Counter Badge (Top Right)
    if (cartCountElement) {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (totalItems === 0) {
            cartCountElement.style.visibility = 'hidden';
            cartCountElement.style.opacity = 0;
            // Optionally set text to '' if visibility doesn't fully hide it
            cartCountElement.textContent = '';
        } else {
            cartCountElement.style.visibility = 'visible';
            cartCountElement.style.opacity = 1;
            cartCountElement.textContent = totalItems;
        }
    }

    // Update Cart Dropdown Content
    if (cartListElement && cartTotalElement) {
        const totalPrice = getCartTotal();
        cartTotalElement.textContent = totalPrice.toFixed(2) + ' EGP';

        if (cart.length === 0) {
            cartListElement.innerHTML = '<p class="empty-cart-message">Your cart is empty.</p>';
        } else {
            cartListElement.innerHTML = cart.map(item => {
                const customizationDetail = item.customization ?
                    `<br><small>(${item.customization.slice(0, 2).join(', ')}${item.customization.length > 2 ? '...' : ''})</small>`
                    : '';
                // Simple display for the dropdown
                return `
                    <div class="cart-item">
                        <span>${item.name} x ${item.quantity} ${customizationDetail}</span>
                        <span>${(item.price * item.quantity).toFixed(2)} EGP</span>
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
    // Keep existing renderShopCartPage function
}

// ====================================
// 10. CHECKOUT PAGE LOGIC
// ====================================
function setupCheckoutPage() {
    // Keep existing setupCheckoutPage function
}
function renderCheckoutSummary(container) {
    // Keep existing renderCheckoutSummary function
}
async function processCheckout(e) {
    // Keep existing processCheckout function
}