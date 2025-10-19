const API_BASE_URL = 'https://siraj-backend.onrender.com'; 
const ITEMS_PER_PAGE = 12;

// **IMPORTANT: Replace this with an actual API call to fetch your live scent options**
const AVAILABLE_SCENTS = [
    "Strawberry Milkshake", "Apple Cinnamon", "Lemon Green Tea", "White Musk", "Tropical Passion", "Vanilla Cookie", "Rose Water", "Coconut Lime", "Fresh Linen"
];

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
        const typeParam = endpointType === 'bundles' ? '&type=bundle' : '';
        
        // FIX: Use correct Casing and Key names from JSON
        const itemName = item['Name (English)'] || item.name || 'Unknown Product';
        const itemPrice = item['Price (EGP)'] || item.price || 0;
        const itemImage = item['Image path'] || item.imageUrl || 'images/placeholder.jpg';
        
        return `
            <div class="product-card">
                <img src="${itemImage}" alt="${itemName}">
                <div class="product-info">
                    <p class="product-title">${itemName}</p>
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
        button.classList.add('pagination-button');
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
// ====================================

// NEW: CATEGORIES LOGIC (To fix the "Loading categories..." message)
async function fetchAndrenderCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;
    
    container.innerHTML = '<p>Loading categories...</p>'; 

    try {
        // Assuming your backend has an /api/categories endpoint
        const response = await fetch(`${API_BASE_URL}/api/categories`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json(); 
        
        // Assuming categories are returned as a flat array or under a 'categories' key
        const categories = data.categories || data;

        if (!Array.isArray(categories) || categories.length === 0) {
            container.innerHTML = '<p>No categories available.</p>';
            return;
        }

        container.innerHTML = categories.map(category => {
            // Use 'name' key or the category string itself
            const name = typeof category === 'string' ? category : (category.name || 'Category'); 
            return `
                <a href="products.html?category=${encodeURIComponent(name)}" class="category-card">
                    <p class="category-name">${name}</p>
                    <i class="fas fa-arrow-right"></i>
                </a>
            `;
        }).join('');

    } catch (error) {
        console.error("Error fetching categories:", error);
        container.innerHTML = '<p>Could not load categories. Please check the API connection.</p>';
    }
}
// END OF NEW CATEGORIES LOGIC

async function fetchBestsellers() {
    const container = document.getElementById('bestsellers-container');
    if (!container) return;
    
    container.innerHTML = '<p>Loading bestsellers...</p>';

    try {
        const { items } = await fetchGridData('/products', 1, 4, '&isBestSeller=true');
        renderProductGrid('bestsellers-container', items, 'products');

    } catch (error) {
        container.innerHTML = '<p>Could not load bestsellers. Please check the API connection.</p>';
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
    
    try {
        const { items } = await fetchGridData('/products', 1, 5, `&search=${encodeURIComponent(query)}`);

        if (items.length === 0) {
            searchResults.innerHTML = `<p>No results found for "${query}".</p>`;
        } else {
            searchResults.innerHTML = items.map(product => `
                <a href="product.html?id=${product._id}" class="search-result-item">
                                        <p class="search-item-title">${product['Name (English)']}</p>
                    <p class="search-item-price">${product['Price (EGP)'].toFixed(2)} EGP</p>
                </a>
            `).join('');
        }
    } catch (error) {
        searchResults.innerHTML = '<p>Search error. Please try again.</p>';
    }
}

// ====================================
// 5. PRODUCTS GRID PAGE LOGIC
// ====================================

function initProductsPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const initialPage = parseInt(urlParams.get('page')) || 1;
    loadProducts(initialPage);
}

async function loadProducts(page) {
    const container = document.getElementById('products-container');
    const paginationControls = document.getElementById('pagination-controls');
    
    container.innerHTML = '<p class="loading-message">Fetching all products...</p>';
    paginationControls.innerHTML = '';
    
    const { items, totalPages, currentPage } = await fetchGridData('/products', page, ITEMS_PER_PAGE);

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
    // Note: Your API uses 'results' for products. If bundles uses a different key, 
    // fetchGridData will try 'bundles', then 'results' for fallback.
    const { items, totalPages, currentPage } = await fetchGridData('/bundles', page, BUNDLE_ITEMS_PER_PAGE);

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

    // FIX: Corrected API path
    const endpoint = type === 'bundle' ? `/api/bundles/${id}` : `/api/products/${id}`;
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const product = await response.json();
        
        // Determine if it's a bundle. Assume bundleItems array exists if it's a customizable bundle.
        product.isBundle = (type === 'bundle' || product.bundleItems); 

        renderProduct(product);
        fetchRelatedProducts(product.category || 'general', product._id); 
        
    } catch (error) {
        console.error(`Error fetching ${type} details:`, error);
        container.innerHTML = `<p>Could not load ${type} details. Please ensure the ID is correct.</p>`;
    }
}

function renderProduct(product) {
    const container = document.getElementById('product-detail-container');
    
    // FIX: Use correct Casing and Key names from JSON
    const itemName = product['Name (English)'] || product.name || 'Unknown Product';
    const itemPrice = product['Price (EGP)'] || product.price || 0;
    const itemImage = product['Image path'] || product.imageUrl || 'images/placeholder.jpg';
    
    const isOutOfStock = product.stockCount <= 0;
    
    document.title = `${itemName} | Siraj Candles`;
    document.querySelector('meta[name="description"]').setAttribute('content', (product.description || '').substring(0, 150) + '...');
    
    // --- Bundle Customization Logic ---
    let customizationHTML = '';
    const isBundle = product.isBundle; 
    const numItemsInBundle = isBundle ? (product.bundleItems?.length || 3) : 0;
    
    if (isBundle) {
        const scentOptions = AVAILABLE_SCENTS.map(scent => 
            `<option value="${scent}">${scent}</option>`
        ).join('');

        let bundleSelectors = `<div class="bundle-customization-section">
            <p class="customization-prompt">Choose scents for your bundle:</p>`;

        for (let i = 1; i <= numItemsInBundle; i++) {
            // Use item name if provided by API, otherwise default
            const bundleItemName = product.bundleItems?.[i-1]?.name || `Item ${i} - Product`;
            
            bundleSelectors += `
                <div class="bundle-selector-group">
                    <label for="scent-${i}">${bundleItemName}:</label>
                    <select id="scent-${i}" class="scent-selector" required>
                        <option value="">-- Select a scent --</option>
                        ${scentOptions}
                    </select>
                </div>
            `;
        }
        bundleSelectors += `</div>`;
        customizationHTML = bundleSelectors;
    }
    // ------------------------------------

    container.innerHTML = `
        <div class="product-detail-grid">
            <div class="product-image-area">
                <img src="${itemImage}" alt="${itemName}" class="main-product-image">
            </div>
            
            <div class="product-info-area">
                <h1 class="product-title">${itemName}</h1>
                <p class="product-category">${product.Category || product.category || ''}</p>
                <p class="product-price">${itemPrice.toFixed(2)} EGP</p>
                
                <p class="stock-status ${isOutOfStock ? 'out-of-stock' : 'in-stock'}">
                    ${isOutOfStock ? 'Out of Stock' : 'In Stock'}
                </p>

                <p class="product-description">
                    ${product['Description (English)'] || product.description || 'No description provided.'}
                </p>
                
                ${customizationHTML}

                ${!isOutOfStock ? `
                    <div class="quantity-selector" style="${isBundle ? 'margin-top: 1rem;' : ''}">
                        <label for="quantity">Quantity:</label>
                        <input type="number" id="quantity" value="1" min="1" max="${product.stockCount || 10}">
                    </div>
                    <button id="add-to-cart-btn" class="add-to-cart-btn" 
                            data-is-bundle="${isBundle}" data-bundle-items="${numItemsInBundle}">
                        Add to Cart
                    </button>
                ` : '<button class="add-to-cart-btn out-of-stock-btn" disabled>Notify Me When Available</button>'}

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

    if (!isOutOfStock) {
        document.getElementById('add-to-cart-btn').addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const isBundleBtn = btn.getAttribute('data-is-bundle') === 'true';
            const quantityInput = document.getElementById('quantity');
            const quantity = parseInt(quantityInput ? quantityInput.value : 1);
            
            let customization = null;
            
            if (isBundleBtn) {
                customization = collectBundleScents(parseInt(btn.getAttribute('data-bundle-items')));
                if (!customization) return; // Stops if not all scents are selected
            }

            const item = {
                _id: product._id,
                // FIX: Use correct Casing and Key names from JSON
                name: itemName,
                price: itemPrice,
                quantity: quantity,
                customization: customization
            };
            addToCart(item);
        });
    }
}

function collectBundleScents(numItems) {
    const scents = [];
    let allSelected = true;
    for (let i = 1; i <= numItems; i++) {
        const selector = document.getElementById(`scent-${i}`);
        if (!selector || selector.value === "") {
            alert(`Please choose a scent for Item ${i}.`);
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
        const query = `&category=${category}&limit=4&exclude_id=${excludeId}`;
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
    alert(`${product.name} (x${product.quantity || 1}) added to cart!`);
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
    
    cartCountElement.textContent = totalItems;
    cartTotalElement.textContent = totalPrice.toFixed(2) + ' EGP';

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

        return `
            <tr data-id="${uniqueId}">
                <td class="cart-product-col" data-label="Product">
                    <img src="${item.imageUrl || 'images/placeholder.jpg'}" alt="${item.name}" class="cart-item-img">
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
            alert('Order placed successfully! Your Order ID is: ' + result.orderId);
            cart = []; 
            saveCartToStorage();
            updateCartUI();
            window.location.href = 'index.html'; 
        } else {
            throw new Error(result.message || 'Failed to place order.');
        }

    } catch (error) {
        alert('Order failed: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Place Order';
    }
}