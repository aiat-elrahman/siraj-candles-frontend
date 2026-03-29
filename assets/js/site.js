const API_BASE_URL = 'https://siraj-backend.onrender.com'; 
const ITEMS_PER_PAGE = 12; 

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadCartFromStorage();
    loadHeroSettings();
    buildMobileMenu();  // ← NEW: builds dynamic mobile menu on every page
 
    const pageName = document.body.getAttribute('data-page');
    switch (pageName) {
        case 'home':
            fetchAndRenderCategories();
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
        case 'category-landing':       // ← NEW page
            initCategoryLandingPage();
            break;
        default:
            break;
    }
});
function setupEventListeners() {
    // 1. Search Toggle
    const sToggle = document.getElementById('search-toggle');
    if (sToggle) {
        sToggle.addEventListener('click', () => {
            const modal = document.getElementById('search-modal');
            const input = document.getElementById('search-input');
            if(modal) modal.style.display = 'flex';
            if(input) input.focus();
        });
    }

    // 2. Close Search
    const cSearch = document.querySelector('.close-search');
    if (cSearch) {
        cSearch.addEventListener('click', () => {
            const modal = document.getElementById('search-modal');
            const results = document.getElementById('search-results');
            if(modal) modal.style.display = 'none';
            if(results) results.innerHTML = '';
        });
    }

    // 3. Cart Toggle
    const cToggle = document.getElementById('cart-toggle');
    if (cToggle) {
        cToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('cart-dropdown');
            if(dropdown) dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        });
    } 

    // 4. Mobile Menu Toggle (FIXED)
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-nav-menu');

    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            mobileMenu.classList.toggle('active');
            document.body.classList.toggle('mobile-menu-open');
        });
    }

    // 5. Click Outside to Close (FIXED)
    document.body.addEventListener('click', (e) => {
        const dropdown = document.getElementById('cart-dropdown');
        const toggle = document.getElementById('cart-toggle');
        const modal = document.getElementById('search-modal');
        
        if (dropdown && dropdown.style.display === 'block' && !dropdown.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
            dropdown.style.display = 'none';
        }
        if (modal && modal.style.display === 'flex' && !modal.contains(e.target) && e.target.id !== 'search-toggle' && !e.target.closest('#search-toggle')) {
            modal.style.display = 'none';
        }
        if (mobileMenu && mobileMenu.classList.contains('active') && !mobileMenu.contains(e.target) && e.target !== menuToggle && !menuToggle.contains(e.target)) {
            menuToggle.classList.remove('active');
            mobileMenu.classList.remove('active');
            document.body.classList.remove('mobile-menu-open');
        }
    });

    // 6. Search Input Logic (FIXED)
    const sInput = document.getElementById('search-input');
    if (sInput) {
        // Clone to remove old broken listeners
        const newSearchInput = sInput.cloneNode(true);
        sInput.parentNode.replaceChild(newSearchInput, sInput);
        
        // Attach new listeners
        newSearchInput.addEventListener('input', debounce(handleSearch, 300));
        newSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                window.location.href = `products.html?search=${encodeURIComponent(newSearchInput.value)}`;
            }
        });
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
function getCategoryUrl(category) {
    if (category.subcategories && category.subcategories.length > 0) {
        return `category.html?category=${encodeURIComponent(category.name)}`;
    }
    return `products.html?category=${encodeURIComponent(category.name)}`;
}
 
async function fetchAndRenderCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;
    container.innerHTML = '<p class="loading-message">Loading categories...</p>';
    try {
        const response = await fetch(`${API_BASE_URL}/api/categories`);
        if (!response.ok) throw new Error('Failed to load categories');
        const categories = await response.json();
        categories.sort((a, b) => a.sortOrder - b.sortOrder);
        if (categories.length === 0) {
            container.innerHTML = '<p class="no-products-message">No categories found.</p>';
            return;
        }
        container.innerHTML = categories.map(cat => {
            let imageSrc = cat.image || 'assets/images/placeholder.jpg';
            if (imageSrc.includes('res.cloudinary.com')) {
                imageSrc = imageSrc.replace('/upload/', '/upload/f_auto,q_auto,w_400/');
            }
            const url = getCategoryUrl(cat);
            const hasSubcats = cat.subcategories && cat.subcategories.length > 0;
            return `
                <a href="${url}" class="category-card-item">
                    <div class="category-image-wrapper">
                        <img src="${imageSrc}" alt="${cat.name}" class="category-image" loading="lazy">
                    </div>
                    <div class="category-info">
                        <p class="category-name">${cat.name}</p>
                        <span class="category-arrow">${hasSubcats ? '›' : '→'}</span>
                    </div>
                </a>
            `;
        }).join('');
    } catch (error) {
        console.error("Error fetching categories:", error);
        container.innerHTML = '<p class="error-message">Could not load categories.</p>';
    }
}
async function buildMobileMenu() {
    const mobileMenu = document.getElementById('mobile-nav-menu');
    if (!mobileMenu) return;
 
    let categories = [];
    try {
        const res = await fetch(`${API_BASE_URL}/api/categories`);
        if (res.ok) {
            const data = await res.json();
            categories = data.sort((a, b) => a.sortOrder - b.sortOrder);
        }
    } catch (e) { console.error('Menu load failed', e); }
 
    let html = `
        <div class="mobile-menu-header">
            <button class="mobile-menu-close" id="mobile-menu-close">✕</button>
        </div>
        <nav class="mobile-menu-nav">
            <a href="index.html" class="mobile-nav-link">Home</a>
            <div class="mobile-nav-item has-children">
                <button class="mobile-nav-link mobile-nav-parent" data-target="mobile-products-sub">
                    Products <span class="mobile-nav-arrow">›</span>
                </button>
                <div class="mobile-nav-submenu" id="mobile-products-sub">
    `;
 
    categories.forEach(cat => {
        const hasSubcats = cat.subcategories && cat.subcategories.length > 0;
        if (hasSubcats) {
            html += `
                <div class="mobile-nav-item has-children">
                    <button class="mobile-nav-sublink mobile-nav-parent" data-target="mobile-sub-${cat._id}">
                        ${cat.name} <span class="mobile-nav-arrow">›</span>
                    </button>
                    <div class="mobile-nav-submenu mobile-nav-submenu--deep" id="mobile-sub-${cat._id}">
                        <a href="category.html?category=${encodeURIComponent(cat.name)}" class="mobile-nav-deeplink mobile-nav-deeplink--all">Browse All ${cat.name}</a>
                        ${cat.subcategories.map(sub => `
                            <a href="products.html?category=${encodeURIComponent(cat.name)}&sub=${encodeURIComponent(sub)}" class="mobile-nav-deeplink">${sub}</a>
                        `).join('')}
                    </div>
                </div>`;
        } else {
            html += `<a href="products.html?category=${encodeURIComponent(cat.name)}" class="mobile-nav-sublink">${cat.name}</a>`;
        }
    });
 
    html += `</div></div><a href="bundles.html" class="mobile-nav-link">Bundles</a></nav>`;
    mobileMenu.innerHTML = html;
 
    mobileMenu.querySelectorAll('.mobile-nav-parent').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetId = btn.getAttribute('data-target');
            const submenu = document.getElementById(targetId);
            if (!submenu) return;
            const isOpen = submenu.classList.contains('open');
            btn.closest('.mobile-nav-item')?.parentElement?.querySelectorAll('.mobile-nav-submenu').forEach(s => {
                if (s !== submenu) { s.classList.remove('open'); s.previousElementSibling?.querySelector('.mobile-nav-arrow')?.classList.remove('rotated'); }
            });
            submenu.classList.toggle('open', !isOpen);
            btn.querySelector('.mobile-nav-arrow')?.classList.toggle('rotated', !isOpen);
        });
    });
 
    document.getElementById('mobile-menu-close')?.addEventListener('click', () => {
        const toggle = document.getElementById('mobile-menu-toggle');
        mobileMenu.classList.remove('active');
        toggle?.classList.remove('active');
        document.body.classList.remove('mobile-menu-open');
    });
}
 
// ── Category Landing Page ─────────────────────────────────────
async function initCategoryLandingPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const categoryName = urlParams.get('category');
    if (!categoryName) { window.location.href = 'products.html'; return; }

    document.title = `${categoryName} | Siraj Candles`;

    const breadcrumbCurrent = document.getElementById('breadcrumb-current');
    const titleEl = document.getElementById('category-title');
    if (breadcrumbCurrent) breadcrumbCurrent.textContent = categoryName;
    if (titleEl) titleEl.textContent = categoryName;

    try {
        const res = await fetch(`${API_BASE_URL}/api/categories`);
        if (!res.ok) throw new Error('Failed to load categories');
        const allCategories = await res.json();

        const category = allCategories.find(
            c => c.name.toLowerCase() === categoryName.toLowerCase()
        );

        // If no category found or no subcategories → redirect to products page
        if (!category || !category.subcategories || category.subcategories.length === 0) {
            window.location.href = `products.html?category=${encodeURIComponent(categoryName)}`;
            return;
        }

        // Set banner image
        const bannerEl = document.getElementById('category-banner');
        if (bannerEl && category.image) {
            bannerEl.style.backgroundImage = `url(${category.image})`;
            bannerEl.style.display = 'block';
        }

        // Set subtitle
        const subtitleEl = document.getElementById('category-subtitle');
        if (subtitleEl) subtitleEl.textContent = `Browse our ${category.name} collection`;

        // Render subcategory cards
        const container = document.getElementById('subcategory-container');
        if (container) {
            container.innerHTML = category.subcategories.map(sub => {
                // Handle both old string format and new object format {name, image}
                const subName  = typeof sub === 'string' ? sub : sub.name;
                const subImage = typeof sub === 'string' ? category.image : (sub.image || category.image);

                let imageSrc = subImage || 'assets/images/placeholder.jpg';
                if (imageSrc.includes('res.cloudinary.com')) {
                    imageSrc = imageSrc.replace('/upload/', '/upload/f_auto,q_auto,w_400/');
                }

                const url = `products.html?category=${encodeURIComponent(category.name)}&sub=${encodeURIComponent(subName)}`;

                return `
                    <a href="${url}" class="category-card-item subcategory-card">
                        <div class="category-image-wrapper">
                            <img src="${imageSrc}" alt="${subName}" class="category-image" loading="lazy">
                            <div class="subcategory-overlay">
                                <span class="subcategory-overlay-text">${subName}</span>
                            </div>
                        </div>
                        <div class="category-info">
                            <p class="category-name">${subName}</p>
                            <span class="category-arrow">→</span>
                        </div>
                    </a>
                `;
            }).join('');
        }

        // Show all products from this category below the subcategory cards
        const section    = document.getElementById('category-all-products-section');
        const prodGrid   = document.getElementById('category-products-container');
        const heading    = document.getElementById('all-products-heading');

        if (section && prodGrid) {
            if (heading) heading.textContent = `All ${categoryName} Products`;
            const { items } = await fetchGridData(
                '/products', 1, 8,
                `&category=${encodeURIComponent(categoryName)}`
            );
            if (items.length > 0) {
                section.style.display = 'block';
                renderProductGrid('category-products-container', items, 'products');
            }
        }

    } catch (error) {
        console.error('Category page error:', error);
        window.location.href = `products.html?category=${encodeURIComponent(categoryName)}`;
    }
}

async function loadHeroSettings() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/settings/hero`);
        const heroData = await response.json();

        const heroSection = document.querySelector('.hero-section');
        const heroButton = document.getElementById('hero-button');
        const heroTitle = document.getElementById('hero-title');
        const heroSubtitle = document.getElementById('hero-subtitle');

        if (heroData.backgroundImage && heroSection) {
            heroSection.style.backgroundImage = `url(${heroData.backgroundImage})`;
            heroSection.style.backgroundSize = 'cover';
            heroSection.style.backgroundPosition = 'center';
        }

        if (heroData.title && heroTitle) {
            heroTitle.textContent = heroData.title;
            heroTitle.style.display = 'block';
        }

        if (heroData.subtitle && heroSubtitle) {
            heroSubtitle.textContent = heroData.subtitle;
            heroSubtitle.style.display = 'block';
        }

        if (heroData.buttonText && heroButton) {
            heroButton.textContent = heroData.buttonText;
        }

        if (heroData.buttonLink && heroButton) {
            heroButton.href = heroData.buttonLink;
        }

    } catch (error) {
        console.error('Failed to load hero settings:', error);
        const heroSection = document.querySelector('.hero-section');
        if (heroSection) {
            heroSection.style.backgroundImage = "url('https://res.cloudinary.com/dvr195vfw/image/upload/f_auto,q_auto,w_1200/v1765150425/Your_paragraph_text_1_ck0hsl.png')";
        }
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
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    if (!input || !results) return;

    const query = input.value.trim();
    if (query.length < 2) {
        results.innerHTML = '<p style="padding:10px; color:#666;">Enter at least 2 characters...</p>';
        return;
    }

    results.innerHTML = '<p style="padding:10px;">Searching...</p>';
    results.style.display = 'block';

    try {
        const { items } = await fetchGridData('/products', 1, 5, `&search=${encodeURIComponent(query)}`);

        if (!items || items.length === 0) {
            results.innerHTML = `<p style="padding:10px;">No results found.</p>`;
        } else {
            results.innerHTML = items.map(product => {
                const productName = product.name_en || product.bundleName || product.name;
                let price = product.price_egp || 0;
                if(product.variants && product.variants.length > 0) {
                    price = Math.min(...product.variants.map(v => v.price));
                }
                
                return `
                    <a href="product.html?id=${product._id}" class="search-result-item">
                        <span class="search-item-title">${productName}</span>
                        <span class="search-item-price">${price.toFixed(2)} EGP</span>
                    </a>
                 `;
            }).join('') + 
            `<a href="products.html?search=${encodeURIComponent(query)}" class="search-view-all">View All Results</a>`;
        }
    } catch (error) {
        results.innerHTML = '<p class="error-message">Search error.</p>';
    }
}
// ====================================
// 5. PRODUCTS GRID PAGE LOGIC
// ====================================

async function initProductsPage() {
    const filterSortBar = document.getElementById('filter-sort-bar');
    if (filterSortBar) {
        filterSortBar.innerHTML = await renderFilterSortBar();
        document.getElementById('sort-by-select').addEventListener('change', () => loadProducts(1));
        document.getElementById('filter-category-select').addEventListener('change', () => loadProducts(1));
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const initialPage = parseInt(urlParams.get('page')) || 1;
    loadProducts(initialPage);
}

async function renderFilterSortBar() {
    const urlParams = new URLSearchParams(window.location.search);
    const currentSort = urlParams.get('sort') || 'name_asc';
    const currentCategory = urlParams.get('category') || '';

    // Fetch live categories from your admin/API
    let categoryOptions = '<option value="">All Categories</option>';
    try {
        const response = await fetch(`${API_BASE_URL}/api/categories`);
        if (response.ok) {
            const categories = await response.json();
            categories.sort((a, b) => a.sortOrder - b.sortOrder);
            categoryOptions += categories.map(cat => 
                `<option value="${cat.name}" ${currentCategory === cat.name ? 'selected' : ''}>${cat.name}</option>`
            ).join('');
        }
    } catch (e) {
        console.error('Could not load categories for filter:', e);
    }

    return `
        <div class="filter-controls-group">
            <div class="filter-row">
                <div class="filter-item">
                    <label for="filter-category-select">Category:</label>
                    <select id="filter-category-select" class="filter-select">
                        ${categoryOptions}
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

    const categorySelect = document.getElementById('filter-category-select');
    const sortSelect = document.getElementById('sort-by-select');
    const urlParams = new URLSearchParams(window.location.search);

    // Always read search from URL
    const searchQuery = urlParams.get('search') || '';

    // ✅ FIX: Read category from URL first (handles homepage → category clicks)
    // Only trust the dropdown if it has a value AND the URL has no category
    // (meaning the user changed it manually via the dropdown)
    let filterCategory = urlParams.get('category') || '';
    if (categorySelect && categorySelect.value && categorySelect.value !== filterCategory) {
        // User changed the dropdown manually — trust the dropdown
        filterCategory = categorySelect.value;
    }

    // Sync dropdown to match the active category
    if (categorySelect && filterCategory) {
        categorySelect.value = filterCategory;
    }

    // Update URL to reflect current state
    const url = new URL(window.location);
    if (filterCategory) url.searchParams.set('category', filterCategory);
    else url.searchParams.delete('category');
    if (searchQuery) url.searchParams.set('search', searchQuery);
    window.history.pushState({}, '', url);

    let sortBy = sortSelect ? sortSelect.value : (urlParams.get('sort') || 'name_asc');


 
    let query = '';
  const subCategory = new URLSearchParams(window.location.search).get('sub') || '';
if (subCategory) query += `&sub=${encodeURIComponent(subCategory)}`;
    if (subCategory) query += `&sub=${encodeURIComponent(subCategory)}`;
    if (searchQuery) query += `&search=${encodeURIComponent(searchQuery)}`;
    if (sortBy) {
        const [sortField, sortOrder] = sortBy === 'newest' ? ['createdAt', 'desc'] : sortBy.split('_');
        if (sortField && sortOrder) query += `&sort=${sortField}&order=${sortOrder}`;
    }

    container.innerHTML = '<p class="loading-message">Fetching products...</p>';
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
    if (!container) return;

    try {
        // 1. Fetch a larger batch of random products (no category filter)
        // We ask for 20 items so we can pick 4 random ones from them
        const { items } = await fetchGridData('/products', 1, 20, `&exclude_id=${excludeId}&status=Active`);
        
        if (!items || items.length === 0) {
            container.innerHTML = '<p class="no-products-message">Check out our latest collection!</p>';
            return;
        }

        // 2. Shuffle the array to get random items
        const shuffled = items.sort(() => 0.5 - Math.random());

        // 3. Take the first 4
        const randomSelection = shuffled.slice(0, 4);

        // 4. Render
        renderProductGrid('related-products-container', randomSelection, 'products');

    } catch (error) {
        console.error("Error fetching related products:", error);
        container.innerHTML = ''; 
    }
}

function renderProduct(product) {
    const container = document.getElementById('product-detail-container');
    const itemName = product.isBundle ? product.bundleName : product.name_en;
    const itemCategory = product.category;
    const itemStock = product.stock || 0;
    const isOutOfStock = itemStock <= 0;
    
    // --- Logic to determine Initial Price ---
    let displayPrice = product.price_egp || 0;
    let hasVariants = false;
    
    if (product.variants && product.variants.length > 0) {
        hasVariants = true;
        displayPrice = product.variants[0].price;
    }

    // Image Gallery (Scrollable Thumbnails)
    const imageGalleryHTML = (product.imagePaths || []).map((path, idx) => 
        `<img src="${path}" class="thumbnail-image ${idx === 0 ? 'active' : ''}" onclick="swapImage(this)" alt="Thumbnail ${idx + 1}">`
    ).join('');

    // HTML Structure
    container.innerHTML = `
        <div class="product-detail-grid-new"> 
            <div class="product-image-area-new">
                <div class="main-image-container">
                    <img src="${product.imagePaths?.[0] || ''}" id="main-display-image" class="main-product-image">
                </div>
                <div class="thumbnail-row">
                     ${imageGalleryHTML}
                </div>
            </div>

            <div class="product-info-area-new">
                <h1 class="product-title-main">${itemName}</h1>
                <p class="product-category-subtle">${itemCategory}</p> 
                
                <p class="product-price-main" id="dynamic-price">${displayPrice.toFixed(2)} EGP</p>

                ${!isOutOfStock || hasVariants ? `
                    <div class="product-actions-grid">
                        <div id="variant-selector-container"></div>
                        
                        <div class="quantity-selector-box">
                            <button class="action-btn" onclick="adjustQty(-1)">-</button>
                            <input type="number" id="quantity" value="1" min="1" max="${itemStock}" readonly class="quantity-input-box">
                            <button class="action-btn" onclick="adjustQty(1)">+</button>
                        </div>

                        <div id="options-container" class="options-container"></div>
                        <div id="bundle-items-container" class="bundle-items-container"></div>

                        <button id="add-to-cart-btn" class="action-add-to-cart-btn">Add to Cart</button>
                    </div>
                ` : `<p class="stock-status out-of-stock">Out of Stock</p>`}

                <div class="product-description-section">
                    <h3>Description</h3>
                    <p>${(product.isBundle ? product.bundleDescription : product.description_en) || 'No description available.'}</p>
                    ${product.formattedDescription ? `<div class="formatted-desc">${product.formattedDescription}</div>` : ''}
                </div>

                <div id="product-specifications-section" class="product-specifications-section" style="display:none;">
                    <h3>Specifications</h3>
                    <div id="specifications-container"></div>
                </div>

                <div class="shipping-returns-new">
                    <h3>Shipping & Returns</h3>
                    <ul>
                        <li>Orders processed within 1–2 business days.</li>
                        <li>Delivery across Egypt within 5-7 days.</li>
                    </ul>
                </div>
                
                <div id="care-instructions-section" class="care-instructions-section" style="display:none;">
                    <h3>Product Care</h3>
                    <div id="care-instructions-container" class="care-grid"></div>
                </div>
            </div> 
        </div>
    `;

    // --- Activate Features ---
    if (hasVariants) renderVariantSelector(product.variants);
    renderProductOptions(product);
    if (product.isBundle) renderBundleItems(product);
    renderProductSpecifications(product); // Show Specs Table
    fetchAndRenderCare(product.category); // Show Care Instructions

    const addBtn = document.getElementById('add-to-cart-btn');
    if (addBtn) addBtn.addEventListener('click', () => addToCartHandler(product));
}

function renderMainProductDetails(container, product, isBundle, itemName, itemPrice, itemCategory, itemStock, isOutOfStock) {
    // Attributes for main product display
    const attributes = [];
    const category = product.category;

    // NEW: Add all specs as chips
    if (!isBundle) {
        // Universal Specs
        if (product.scents && !product.scentOptions) attributes.push({ label: 'Scent', value: product.scents, icon: '🌸' });
        if (product.size) attributes.push({ label: 'Size', value: product.size, icon: '📏' });

        // Category-Specific Specs
        switch (category) {
            case 'Candles':
            case 'Pottery Collection':
                if (product.burnTime) attributes.push({ label: 'Burn Time', value: product.burnTime, icon: '🔥' });
                if (product.wickType) attributes.push({ label: 'Wick', value: product.wickType, icon: '🕯️' });
                if (product.coverageSpace) attributes.push({ label: 'Coverage', value: product.coverageSpace, icon: '🏠' });
                break;
            case 'Deodorant':
                if (product.skinType) attributes.push({ label: 'Skin Type', value: product.skinType, icon: '✨' });
                if (product.keyIngredients) attributes.push({ label: 'Ingredients', value: product.keyIngredients, icon: '🌿' });
                break;
            case 'Soap':
                if (product.soapWeight) attributes.push({ label: 'Weight', value: product.soapWeight, icon: '⚖️' });
                if (product.featureBenefit) attributes.push({ label: 'Feature', value: product.featureBenefit, icon: '✨' });
                if (product.keyIngredients) attributes.push({ label: 'Ingredients', value: product.keyIngredients, icon: '🌿' });
                break;
            case 'Body Splash':
                // Already handled by universal 'scents'
                break;
            case 'Body Oil':
                if (product.color) attributes.push({ label: 'Color', value: product.color, icon: '🎨' });
                if (product.oilWeight) attributes.push({ label: 'Size', value: product.oilWeight, icon: '💧' });
                break;
            case 'Massage Candles':
                if (product.massageWeight) attributes.push({ label: 'Weight', value: product.massageWeight, icon: '⚖️' });
                break;
            case 'Wax Burners':
                if (product.dimensions) attributes.push({ label: 'Dimensions', value: product.dimensions, icon: '📏' });
                break;

        }
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
                        <li>Delivery across Egypt within 5-7 days.</li>
                        <li>Due to the handmade nature of our products, returns and exchanges are not accepted</li>
                    </ul>
                </div>
            </div> 
        </div>
    `;
}

// FIXED: Render product specifications with original table layout

// --- NEW HELPER FUNCTIONS (Paste at bottom of file) ---

// FIXED: Render Specs as Cute Chips (Badges) instead of Table
function renderProductSpecifications(product) {
    const section = document.getElementById('product-specifications-section');
    const container = document.getElementById('specifications-container');
    
    if (!section || !container) return;

    const specs = [];
    const category = product.category;

    // Define specs with Icons for the "Cute" look
    switch (category) {
        case 'Candles':
        case 'Pottery Collection':
            if (product.burnTime) specs.push({ label: 'Burn Time', value: product.burnTime, icon: '🔥' });
            if (product.wickType) specs.push({ label: 'Wick', value: product.wickType, icon: '🕯️' });
            if (product.coverageSpace) specs.push({ label: 'Coverage', value: product.coverageSpace, icon: '🏠' });
            if (product.scents && !product.scentOptions) specs.push({ label: 'Scent', value: product.scents, icon: '🌸' });
            break;
        case 'Deodorant':
            if (product.skinType) specs.push({ label: 'Skin', value: product.skinType, icon: '✨' });
            if (product.keyIngredients) specs.push({ label: 'Ingredients', value: product.keyIngredients, icon: '🌿' });
            break;
        case 'Soap':
            if (product.soapWeight) specs.push({ label: 'Weight', value: product.soapWeight, icon: '⚖️' });
            if (product.featureBenefit) specs.push({ label: 'Benefit', value: product.featureBenefit, icon: '🛁' });
            break;
        case 'Wax Burners':
            if (product.dimensions) specs.push({ label: 'Dimensions', value: product.dimensions, icon: '📏' });
            break;
        // ... Add other categories as needed ...
    }

    if (specs.length > 0) {
        section.style.display = 'block';
        // Render as a Grid of Chips
        container.innerHTML = `
            <div class="product-attributes-grid">
                ${specs.map(spec => `
                    <div class="attribute-chip">
                        <span class="attribute-icon">${spec.icon || '🔹'}</span>
                        <span class="attribute-label">${spec.label}:</span>
                        <span class="attribute-value">${spec.value}</span>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        section.style.display = 'none';
    }
}

// 3. Variants Selector
function renderVariantSelector(variants) {
    const container = document.getElementById('variant-selector-container');
    if (!container) return;
    container.innerHTML = `<div class="option-group"><label>Option:</label><select id="variant-select" class="option-selector">` +
        variants.map((v, i) => `<option value="${v.variantName}" data-price="${v.price}" data-stock="${v.stock}" ${i===0?'selected':''}>${v.variantName} - ${v.price} EGP</option>`).join('') +
        `</select></div>`;
        
    document.getElementById('variant-select').addEventListener('change', (e) => {
        const price = e.target.options[e.target.selectedIndex].getAttribute('data-price');
        document.getElementById('dynamic-price').textContent = `${parseFloat(price).toFixed(2)} EGP`;
    });
}

// 4. Add to Cart Handler (Variants)
function addToCartHandler(product) {
    const qty = parseInt(document.getElementById('quantity').value);
    let price = product.price_egp || 0, variant = null;
    
    const vSelect = document.getElementById('variant-select');
    if (vSelect) {
        const opt = vSelect.options[vSelect.selectedIndex];
        price = parseFloat(opt.getAttribute('data-price'));
        variant = vSelect.value;
        const stock = parseInt(opt.getAttribute('data-stock'));
        if(stock < qty) { alert(`Only ${stock} left!`); return; }
    }

    const cartItem = {
        _id: product._id,
        name: product.isBundle ? product.bundleName : product.name_en,
        category: product.category || '',
        price: price,
        quantity: qty,
        imageUrl: product.imagePaths?.[0],
        variantName: variant,
        customization: collectAllSelections(product) || []
    };
    addToCart(cartItem);
}

//  Helper: Adjust Qty
window.adjustQty = (d) => {
    const i = document.getElementById('quantity');
    let n = parseInt(i.value) + d;
    if(n < 1) n = 1;
    i.value = n;
};

// Helper: Collect All Selections (Options & Bundles)
function collectAllSelections(product) {
    const selections = [];
    let validationFailed = false;

    // 1. Collect from Standard Options (Scent, Size, Shape, etc.)
    const optionSelectors = [
    'opt-scent', 'opt-shape', 'opt-type', 'opt-size'
];


    optionSelectors.forEach(selectorId => {
        const selector = document.getElementById(selectorId);
        if (selector) {
            // Check if it is required but empty
            if (selector.required && !selector.value) {
                selector.focus(); // Highlight the missing field
                validationFailed = true;
            } else if (selector.value) {
                // Format as "Type: Value" (e.g., "scent: Vanilla")
                selections.push(`${selectorId.replace('-option', '')}: ${selector.value}`);
            }
        }
    });

    // Stop if any standard option is missing
    if (validationFailed) return null;

    // 2. Collect from Bundle Items (if applicable)
    if (product.isBundle) {
        const bundleItems = product.bundleItems || [];
        for (let i = 0; i < bundleItems.length; i++) {
            const selector = document.getElementById(`bundle-scent-${i}`);
            
            // specific check for bundle selectors
            if (!selector || !selector.value) {
                selector?.focus();
                return null; // Stop immediately
            }
            
            // Format as "SubProduct: Scent"
            selections.push(`${bundleItems[i].subProductName}: ${selector.value}`);
        }
    }

    return selections;
}
function renderProductOptions(product) {
    const container = document.getElementById('options-container');
    if(!container) return;
    
    const createSelect = (label, optionsStr, id) => {
        if (!optionsStr) return '';
        const opts = optionsStr.split(',').map(s=>s.trim()).filter(Boolean);
        if(opts.length === 0) return '';
        
        return `
            <div class="option-group">
                <label for="${id}">${label}:</label>
                <select id="${id}" class="option-selector product-custom-option" required>
                    <option value="">-- Select --</option>
                    ${opts.map(o => `<option value="${o}">${o}</option>`).join('')}
                </select>
            </div>
        `;
    };

    let html = '';
    html += createSelect('Scent', product.scentOptions, 'opt-scent');
    html += createSelect('Shape', product.shapeOptions, 'opt-shape');
    html += createSelect('Type', product.typeOptions, 'opt-type');
    

    if (!product.variants || product.variants.length === 0) {
        html += createSelect('Size/Weight', product.sizeOptions || product.weightOptions, 'opt-size');
    }

    container.innerHTML = html;
}
function renderBundleItems(product) {
    const container = document.getElementById('bundle-items-container');
    
    if(!container || !product.bundleItems || product.bundleItems.length === 0) {
        if(container) container.innerHTML = '';
        return;
    }

    
    const itemsHtml = product.bundleItems.map((item, i) => {
        const scents = Array.isArray(item.allowedScents) 
    ? item.allowedScents 
    : (item.allowedScents || '').split(',');
        return `
            <div class="bundle-selector-group">
                <label for="bundle-item-${i}">
                    ${item.subProductName} (${item.size}):
                </label>
                <select id="bundle-item-${i}" class="scent-selector bundle-item-select" required>
                    <option value="">-- Select a scent --</option>
                    ${scents.map(s => `<option value="${s.trim()}">${s.trim()}</option>`).join('')}
                </select>
            </div>
        `;
    }).join('');

    
    container.innerHTML = `
        <div class="bundle-customization-section" style="margin-top: 0;">
            <p class="customization-prompt">Choose your scents:</p>
            ${itemsHtml}
        </div>
    `;
}



function setupBuyNowButton(product) {
    const buyNowBtn = document.querySelector('.buy-it-now-btn');
    if (!buyNowBtn) return;

    buyNowBtn.addEventListener('click', (e) => {
        const quantity = parseInt(document.getElementById('quantity')?.value || 1);
        const customization = collectAllSelections(product);

        // This check is now correct because collectAllSelections handles validation
        if (customization === null) return; // Validation failed

        const itemName = product.isBundle ? product.bundleName : product.name_en;
      const itemPrice = product.price_egp || product.price || 0;

        const item = {
            _id: product._id,
            name: itemName || product.name || 'Product',
category: product.category || '',
            price: itemPrice,
            quantity: quantity,
            // *** THIS IS THE FIX ***
            // Only add customization if the array has items.
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

        // This check is now correct because collectAllSelections handles validation
        if (customization === null) return; // Validation failed

        const itemName = product.isBundle ? product.bundleName : product.name_en;
        const itemPrice = product.price_egp || product.price || 0;

        const item = {
            _id: product._id,
            name: itemName || product.name || 'Product',
 category: product.category || '',
            price: itemPrice,
            quantity: quantity,
            // *** THIS IS THE FIX ***
            // Only add customization if the array has items.
            customization: customization.length > 0 ? customization : null,
            imageUrl: product.imagePaths?.[0] || product.images?.[0] || 'images/placeholder.jpg'
        };
        addToCart(item);
    });
}



// ====================================
// 8. CART MANAGEMENT (FIXED - ALL ISSUES RESOLVED)
// ====================================

let cart = [];

function loadCartFromStorage() {
    const cartData = localStorage.getItem('sirajCart');
    if (cartData) {
        try {
            cart = JSON.parse(cartData) || [];
        } catch(e) {
            cart = [];
            localStorage.removeItem('sirajCart');
        }
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
    if (typeof fbq !== 'undefined') {
        fbq('track', 'AddToCart', {
            content_name: product.name,
            content_ids: [product._id],
            content_type: 'product',
            value: product.price,
            currency: 'EGP'
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
            if (document.body.getAttribute('data-page') === 'shopcart') {
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
function updateCartUI() {
    const countEl = document.querySelector('.cart-count');
    const listEl = document.querySelector('.cart-items-list');
    const totalEl = document.getElementById('cart-total');
    
    if (!countEl) return;

    const totalQty = cart.reduce((s, i) => s + i.quantity, 0);
    countEl.textContent = totalQty;
    countEl.style.opacity = totalQty > 0 ? 1 : 0;
    
    if(totalEl) totalEl.textContent = getCartTotal().toFixed(2) + ' EGP';

    if(listEl) {
        if(cart.length === 0) {
            listEl.innerHTML = '<p class="empty-cart">Your cart is empty.</p>';
        } else {
            listEl.innerHTML = cart.map(item => `
                <div class="cart-item">
                    <img src="${item.imageUrl || 'assets/images/placeholder.jpg'}" style="width:50px; height:50px; border-radius:4px; object-fit:cover;">
                    
                    <div class="cart-item-details">
                        <div class="cart-item-name">${item.name}</div>
                        <span class="cart-item-variant">${item.variantName || ''}</span>
                        <div class="cart-item-price">${item.quantity} x ${item.price} EGP</div>
                    </div>

                    <button class="remove-item-btn" onclick="removeItemFromCart('${getCartUniqueId(item)}')">&times;</button>
                </div>
            `).join('');
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
                <td data-label="Remove">
                    <button class="remove-item-btn" onclick="removeItemFromCart('${uniqueId}')" aria-label="Remove item">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

   const subtotal = getCartTotal();
const freeShipping = subtotal >= 2000;

summaryContainer.innerHTML = `
    <h3>Cart Summary</h3>
    <p>Subtotal: <span>${subtotal.toFixed(2)} EGP</span></p>
    <p>Shipping: <span>${freeShipping ? 'FREE 🎉' : 'Calculated at checkout'}</span></p>
    <p class="cart-total-final">Total: <span>${subtotal.toFixed(2)} EGP${freeShipping ? '' : ' + shipping'}</span></p>
    <a href="checkout.html" class="checkout-btn">Proceed to Checkout</a>
`;
    const checkoutLink = document.getElementById('checkout-link-bottom');
    if (checkoutLink) checkoutLink.style.display = 'block';
}

// ====================================
// 10. CHECKOUT PAGE LOGIC
// ====================================

async function setupCheckoutPage() {
    const summaryContainer = document.getElementById('checkout-summary-container');
    const checkoutForm = document.getElementById('checkout-form'); // <--- 1. Get the form
    const cartItemsContainer = document.getElementById('checkout-cart-items');
    
    if (cart.length === 0) {
        summaryContainer.innerHTML = '<p>Your cart is empty. <a href="products.html">Return to shopping.</a></p>';
        if (checkoutForm) checkoutForm.style.display = 'none';
        return;
    }
    
    renderCheckoutSummary(summaryContainer);
    renderCheckoutCartItems();
    
    // 1. Load Cities
    await loadShippingCities(); 
    await checkAndApplyAutomaticDiscounts();

    // 2. Attach Discount Listener
    const applyBtn = document.getElementById('apply-discount-btn');
    if (applyBtn) {
        applyBtn.replaceWith(applyBtn.cloneNode(true));
        const newBtn = document.getElementById('apply-discount-btn');
        newBtn.addEventListener('click', handleApplyDiscount);
    }

    // 3. ATTACH CHECKOUT SUBMIT LISTENER (THIS WAS MISSING)
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', processCheckout);
    }
}
function renderCheckoutSummary(container) {
    // Initial render structure
    container.innerHTML = `
        <h3>Order Summary</h3>
        <div class="checkout-item-list">
            ${cart.map(item => `
                <p class="checkout-item">
                    ${item.name} x ${item.quantity} 
                    ${item.variantName ? `(${item.variantName})` : ''}
                    <span>${(item.price * item.quantity).toFixed(2)} EGP</span>
                </p>`).join('')}
        </div>
        <hr>
        <p class="checkout-summary-line">Subtotal: <span id="summary-subtotal">0.00 EGP</span></p>
        <p class="checkout-summary-line">Shipping: <span id="summary-shipping">Select City</span></p>
      
    <span class="discount-label">Discount:</span>
      <p class="checkout-summary-line" id="discount-row" style="display:none; color:green;">
            <span class="discount-label">Discount:</span>
            <span id="summary-discount">-0.00 EGP</span>
        </p>
</p>
        <p class="checkout-summary-line final-total">Total: <span id="summary-total">0.00 EGP</span></p>
    `;
    
    // Calculate initial numbers
    updateCheckoutTotals();
}

function updateCheckoutTotals() {
    const subtotal = getCartTotal();
 
    // 1. Shipping Fee
    const citySelect = document.getElementById('city');
    let shippingFee = 0;
 
    if (subtotal >= 2000) {
        shippingFee = 0; // free shipping threshold
    } else if (citySelect && citySelect.options.length > 0 && citySelect.selectedIndex >= 0) {
        const selectedOption = citySelect.options[citySelect.selectedIndex];
        if (selectedOption && selectedOption.dataset.fee) {
            shippingFee = parseFloat(selectedOption.dataset.fee);
        }
    }
 
    // 2. Discount Amount
    let discountAmount = 0;
    let freeShipping = false;
 
    if (appliedDiscount) {
        if (appliedDiscount.isFreeShipping || appliedDiscount.type === 'free_shipping') {
            // Free shipping discount — zero out shipping fee
            freeShipping = true;
            shippingFee = 0;
            discountAmount = 0;
        } else {
            // Use the pre-calculated amount from the backend (already handles category logic)
            discountAmount = appliedDiscount.discountAmount || 0;
        }
    }
 
    const total = Math.max(0, subtotal + shippingFee - discountAmount);
 
    // 3. Update UI
    const subtotalEl  = document.getElementById('summary-subtotal');
    const shippingEl  = document.getElementById('summary-shipping');
    const discountRow = document.getElementById('discount-row');
    const discountEl  = document.getElementById('summary-discount');
    const totalEl     = document.getElementById('summary-total');
 
    if (subtotalEl) subtotalEl.textContent = subtotal.toFixed(2) + ' EGP';
 
    if (shippingEl) {
        if (subtotal >= 2000 || freeShipping) {
            shippingEl.textContent = 'FREE 🎉';
        } else if (shippingFee > 0) {
            shippingEl.textContent = shippingFee.toFixed(2) + ' EGP';
        } else {
            shippingEl.textContent = 'Select City';
        }
    }
 
    if (discountRow) {
    if (discountAmount > 0) {
        discountRow.style.display = 'flex';
        const label = appliedDiscount?.appliesTo === 'categories'
            ? `Discount (${appliedDiscount.categories?.join(', ')} only)`
            : 'Discount';
        // Update label text directly — don't touch innerHTML
        const labelSpan = discountRow.querySelector('.discount-label');
        const valueSpan = discountRow.querySelector('#summary-discount');
        if (labelSpan) labelSpan.textContent = label + ':';
        if (valueSpan) valueSpan.textContent = `-${discountAmount.toFixed(2)} EGP`;
    } else {
        discountRow.style.display = 'none';
    }
}
 
    if (totalEl) totalEl.textContent = total.toFixed(2) + ' EGP';
}
// FIXED: Checkout cart items with working quantity controls & Variant Display
function renderCheckoutCartItems() {
    const container = document.getElementById('checkout-cart-items');
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = '<p class="empty-message">Your cart is empty.</p>';
        return;
    }

    container.innerHTML = cart.map(item => {
        const uniqueId = getCartUniqueId(item);
        
        // --- NEW: Display Variant Name (e.g., "100g") ---
        const variantDisplay = item.variantName 
            ? `<span style="background:#f3f4f6; color:#374151; padding:2px 6px; border-radius:4px; font-size:0.8em; margin-left:5px; border:1px solid #e5e7eb;">${item.variantName}</span>` 
            : '';

        const customizationDetail = item.customization && item.customization.length > 0
            ? `<div class="cart-customization-detail"><small>Options: ${item.customization.join(', ')}</small></div>` 
            : '';
            
        const itemImage = item.imageUrl || 'assets/images/placeholder.jpg';
        const itemTotal = (item.price * item.quantity).toFixed(2);

        return `
            <div class="checkout-cart-item" data-id="${uniqueId}">
                <div class="checkout-item-image">
                    <img src="${itemImage}" alt="${item.name}" loading="lazy">
                </div>
                <div class="checkout-item-details">
                    <h4>${item.name} ${variantDisplay}</h4>
                    ${customizationDetail}
                    <div class="checkout-item-price">${item.price.toFixed(2)} EGP each</div>
                </div>
                <div class="checkout-item-controls">
                    <div class="quantity-controls">
                        <button class="quantity-btn minus" type="button" onclick="updateItemQuantity('${uniqueId}', ${item.quantity - 1})">-</button>
                        <input type="number" value="${item.quantity}" min="1" class="item-quantity-input" 
                               onchange="updateItemQuantity('${uniqueId}', this.value)">
                        <button class="quantity-btn plus" type="button" onclick="updateItemQuantity('${uniqueId}', ${item.quantity + 1})">+</button>
                    </div>
                    <div class="checkout-item-total">${itemTotal} EGP</div>
                    <button class="remove-item-btn" type="button" onclick="removeItemFromCart('${uniqueId}')" aria-label="Remove item">
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
    
    if (!formData.get('city')) {
    alert('Please select your city.');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    return;
}
    const citySelect = document.getElementById('city');
    if (!citySelect || !citySelect.value) {
        alert('Please select your city before placing the order.');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        return;
    }
    const selectedOption = citySelect.options[citySelect.selectedIndex];
    let shippingFee = 0;
    if (totalAmount < 2000) {
        shippingFee = parseFloat(selectedOption.dataset.fee) || 50.00;
    }

    const orderData = {
        customerInfo: {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            address: formData.get('address'),
            city: formData.get('city'),
            notes: formData.get('notes'),
        },
        // --- CRITICAL UPDATE: Mapping Variant Name ---
        items: cart.map(item => ({
            productId: item._id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            // Send variantName so backend knows which stock to deduct (e.g., "60g")
            variantName: item.variantName || null, 
            customization: item.customization || []
        })),
        // --------------------------------------------
        totalAmount: totalAmount + shippingFee,
        subtotal: totalAmount,
        shippingFee: shippingFee,
        paymentMethod: formData.get('payment-method'),
    };
    
    const submitBtn = document.getElementById('place-order-btn');
    const originalText = submitBtn.textContent;
    
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
             if (typeof fbq !== 'undefined') {
            fbq('track', 'Purchase', {
                value: orderData.totalAmount,
                currency: 'EGP',
                content_ids: orderData.items.map(item => item.productId),
                content_type: 'product'
            });
        }
            console.log('Order placed successfully! Your Order ID is: ' + result.orderId);
           if (appliedDiscount?.code) {
    fetch(`${API_BASE_URL}/api/discounts/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: [appliedDiscount.code] })
    });
    appliedDiscount = null;
}
            cart = []; 
            saveCartToStorage();
            updateCartUI();
            alert(`Order placed successfully! \nOrder ID: ${result.orderId}`);
            window.location.href = 'index.html'; 
        } else {
            throw new Error(result.message || 'Failed to place order.');
        }

    } catch (error) {
        console.error('Order failed: ' + error.message);
        alert('Error: ' + error.message); // Will show stock errors if any
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}
// NEW: Fetch Cities and Populate Dropdown
async function loadShippingCities() {
    const citySelect = document.getElementById('city');
    if (!citySelect) return;

    try {
        // Clear current options and add loading
        citySelect.innerHTML = '<option value="">Loading cities...</option>';
        
        const response = await fetch(`${API_BASE_URL}/api/shipping-rates`); // Ensure this route exists in backend
        if (!response.ok) throw new Error('Failed to load cities');
        
        const rates = await response.json();
        
        citySelect.innerHTML = '<option value="">Select your city</option>';
        rates.forEach(rate => {
            // We store the price in a data attribute to access it easily
            const option = document.createElement('option');
            option.value = rate.city;
            option.textContent = rate.city;
            option.dataset.fee = rate.shippingFee; 
            citySelect.appendChild(option);
        });

        // Update total when city changes
        citySelect.addEventListener('change', updateCheckoutTotals);

    } catch (error) {
        console.error(error);
        citySelect.innerHTML = '<option value="">Error loading cities (Standard shipping applies)</option>';
    }
}

// ============================================================
// REPLACE these two functions in your site.js
// (find "let appliedDiscount = null" and replace from there)
// ============================================================
 
let appliedDiscount = null;
 
async function handleApplyDiscount() {
    const codeInput = document.getElementById('discount-code');
    const messageEl = document.getElementById('discount-message');
    const code = codeInput.value.trim().toUpperCase();
 
    if (!code) return;
 
    messageEl.textContent = 'Checking code...';
    messageEl.className = '';
 
    // Build cartItems array so backend can do category-based discounts
    const cartItems = cart.map(item => ({
        category: item.category || '',
        price: item.price,
        quantity: item.quantity
    }));
 
    try {
        const response = await fetch(`${API_BASE_URL}/api/discounts/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                cartTotal: getCartTotal(),
                cartItems   // ← NEW: send cart items for category checking
            })
        });
 
        const data = await response.json();
 
        if (data.valid) {
            appliedDiscount = {
                ...data.discount,
                discountAmount: data.discountAmount  // pre-calculated by backend
            };
            messageEl.textContent = data.message;
            messageEl.className = 'discount-success';
            updateCheckoutTotals();
        } else {
            appliedDiscount = null;
            messageEl.textContent = data.message || 'Invalid code';
            messageEl.className = 'discount-error';
            updateCheckoutTotals();
        }
    } catch (error) {
        console.error(error);
        messageEl.textContent = 'Error checking discount. Please try again.';
        messageEl.className = 'discount-error';
    }
}

async function checkAndApplyAutomaticDiscounts() {
    try {
        const cartItems = cart.map(item => ({
            category: item.category || '',
            price: item.price,
            quantity: item.quantity
        }));

        const response = await fetch(`${API_BASE_URL}/api/discounts/apply-automatic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cartTotal: getCartTotal(),
                cartItems
            })
        });

        const data = await response.json();

        if (data.applied && data.applied.length > 0) {
            const best = data.applied[0];
            appliedDiscount = {
                ...best,
                discountAmount: best.discountAmount
            };

            // Replace the discount code section with a clean auto-discount banner
            const discountSection = document.querySelector('.discount-section');
            if (discountSection) {
                discountSection.innerHTML = `
                    <div class="auto-discount-banner">
                        🎉 ${best.message}
                    </div>
                `;
            }

            // Update totals FIRST so the discount row appears
            updateCheckoutTotals();

            // Then fix the discount row label to not say "Discount:" twice
            // Change the summary row label to be silent — just show the amount
            const discountRow = document.getElementById('discount-row');
            if (discountRow) {
                const labelSpan = discountRow.querySelector('.discount-label');
                if (labelSpan) labelSpan.textContent = ''; // hide the "Discount:" text in summary since banner already shows it
            }

        }
    } catch (error) {
        console.error('Auto-discount check failed:', error);
    }
}

// 3. Helper for Image Swapping
window.swapImage = function(imgElement) {
    // 1. Change the main image
    const mainImage = document.getElementById('main-display-image');
    mainImage.src = imgElement.src;

    // 2. Update active styling on thumbnails
    document.querySelectorAll('.thumbnail-image').forEach(thumb => thumb.classList.remove('active'));
    imgElement.classList.add('active');
}

// --- NEW: Fetch and Render Care Instructions ---
async function fetchAndRenderCare(categoryName) {
    const section = document.getElementById('care-instructions-section');
    const container = document.getElementById('care-instructions-container');
    
    if (!section || !container || !categoryName) return;

    try {
        // Fetch all care instructions (assuming /api/care returns the list like Admin)
        const response = await fetch(`${API_BASE_URL}/api/care`);
        if (!response.ok) return;

        const allInstructions = await response.json();

        // Filter for instructions that match this product's category
        const relevantInstructions = allInstructions.filter(
            item => item.category.toLowerCase() === categoryName.toLowerCase()
        );

        if (relevantInstructions.length === 0) {
            section.style.display = 'none';
            return;
        }

        // Render them
        section.style.display = 'block';
        container.innerHTML = relevantInstructions.map(item => `
            <div class="care-card">
                <div class="care-icon"><i class="fas fa-sparkles"></i></div>
                <div class="care-content">
                    <h4>${item.careTitle}</h4>
                    <p>${item.careContent}</p>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error("Error loading care instructions:", error);
        section.style.display = 'none';
    }
}

