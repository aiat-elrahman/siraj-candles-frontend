const API_BASE_URL = 'https://siraj-backend.onrender.com'; 
const ITEMS_PER_PAGE = 12; 

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadCartFromStorage();
    loadHeroSettings();
    buildMobileMenu();

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
        case 'category-landing':
            initCategoryLandingPage();
            break;
        default:
            break;
    }
});

function setupEventListeners() {
    const sToggle = document.getElementById('search-toggle');
    if (sToggle) {
        sToggle.addEventListener('click', () => {
            const modal = document.getElementById('search-modal');
            const input = document.getElementById('search-input');
            if(modal) modal.style.display = 'flex';
            if(input) input.focus();
        });
    }

    const cSearch = document.querySelector('.close-search');
    if (cSearch) {
        cSearch.addEventListener('click', () => {
            const modal = document.getElementById('search-modal');
            const results = document.getElementById('search-results');
            if(modal) modal.style.display = 'none';
            if(results) results.innerHTML = '';
        });
    }

    const cToggle = document.getElementById('cart-toggle');
    if (cToggle) {
        cToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('cart-dropdown');
            if(dropdown) dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        });
    }

    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-nav-menu');

    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            mobileMenu.classList.toggle('active');
            document.body.classList.toggle('mobile-menu-open');
        });
    }

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

    const sInput = document.getElementById('search-input');
    if (sInput) {
        const newSearchInput = sInput.cloneNode(true);
        sInput.parentNode.replaceChild(newSearchInput, sInput);
        
        newSearchInput.addEventListener('input', debounce(handleSearch, 300));
        newSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                window.location.href = `products.html?search=${encodeURIComponent(newSearchInput.value)}`;
            }
        });
    }
}

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

function renderProductGrid(containerId, items, endpointType) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `<p class="no-products-message">No ${endpointType} found at this time.</p>`;
        return;
    }

    if (!container.classList.contains('product-grid')) {
        container.classList.add('product-grid');
    }

    container.innerHTML = items.map(item => {
        const isBundle = item.productType === 'Bundle' || item.bundleItems;
        const itemName = item.name_en || item.bundleName || item['Name (English)'] || 'Unknown Product';
        const itemPrice = item.price_egp || item.bundlePrice || item['Price (EGP)'] || 0;
        const itemImage = item.imagePaths?.[0] || item['Image path'] || 'images/placeholder.jpg';
        
        return `
            <a href="product.html?id=${item._id}" class="product-card">
                <img src="${itemImage}" alt="${itemName}" loading="lazy"> 
                <div class="product-info-minimal">
                    <p class="product-title">${escapeHtml(itemName)}</p>
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
    
    if (currentPage > 1) {
        controls.appendChild(createButton('← Previous', currentPage - 1));
    }

    for (let i = 1; i <= totalPages; i++) {
        controls.appendChild(createButton(i, i));
    }

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
                        <p class="category-name">${escapeHtml(cat.name)}</p>
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
                        ${escapeHtml(cat.name)} <span class="mobile-nav-arrow">›</span>
                    </button>
                    <div class="mobile-nav-submenu mobile-nav-submenu--deep" id="mobile-sub-${cat._id}">
                        <a href="category.html?category=${encodeURIComponent(cat.name)}" class="mobile-nav-deeplink mobile-nav-deeplink--all">Browse All ${escapeHtml(cat.name)}</a>
                        ${cat.subcategories.map(sub => {
                            const subName = typeof sub === 'string' ? sub : sub.name;
                            return `<a href="products.html?category=${encodeURIComponent(cat.name)}&sub=${encodeURIComponent(subName)}" class="mobile-nav-deeplink">${escapeHtml(subName)}</a>`;
                        }).join('')}
                    </div>
                </div>`;
        } else {
            html += `<a href="products.html?category=${encodeURIComponent(cat.name)}" class="mobile-nav-sublink">${escapeHtml(cat.name)}</a>`;
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
 
// ── Category Landing Page (UPDATED: Fixed Banner + Logic) ─────────────────────────────────────
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

        const hasSubcategories = category && category.subcategories && category.subcategories.length > 0;

        // If no subcategories → redirect to products page (show all products in this category)
        if (!category || !hasSubcategories) {
            window.location.href = `products.html?category=${encodeURIComponent(categoryName)}`;
            return;
        }

        // Set banner as BACKGROUND IMAGE (no stretching)
        const bannerEl = document.getElementById('category-banner');
        if (bannerEl && category.image) {
            bannerEl.style.backgroundImage = `url(${category.image})`;
            bannerEl.style.backgroundSize = 'cover';
            bannerEl.style.backgroundPosition = 'center 30%';
            bannerEl.style.backgroundRepeat = 'no-repeat';
            bannerEl.style.display = 'block';
        }

        const subtitleEl = document.getElementById('category-subtitle');
        if (subtitleEl) subtitleEl.textContent = `Browse our ${category.name} collection`;

        // Render subcategory cards
        const container = document.getElementById('subcategory-container');
        if (container) {
            container.innerHTML = category.subcategories.map(sub => {
                const subName = typeof sub === 'string' ? sub : sub.name;
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
                                <span class="subcategory-overlay-text">${escapeHtml(subName)}</span>
                            </div>
                        </div>
                        <div class="category-info">
                            <p class="category-name">${escapeHtml(subName)}</p>
                            <span class="category-arrow">→</span>
                        </div>
                    </a>
                `;
            }).join('');
        }

        // HIDE the "All Products" section when there are subcategories (per your request)
        const allProductsSection = document.getElementById('category-all-products-section');
        if (allProductsSection) {
            allProductsSection.style.display = 'none';
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
            heroSection.style.backgroundImage = "url('https://res.cloudinary.com/dvr195vfw/image/upload/v1776209850/Gemini_Generated_Image__3_bylucb.png')";
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
                let price = product.price_egp || product.bundlePrice || 0;
                if(product.variants && product.variants.length > 0) {
                    price = Math.min(...product.variants.map(v => v.price));
                }
                
                return `
                    <a href="product.html?id=${product._id}" class="search-result-item">
                        <span class="search-item-title">${escapeHtml(productName)}</span>
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
// PRODUCTS PAGE (UPDATED: Parent category includes subcategories)
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
    if (!container) return;

    const categorySelect = document.getElementById('filter-category-select');
    const sortSelect = document.getElementById('sort-by-select');
    const urlParams = new URLSearchParams(window.location.search);

    const searchQuery = urlParams.get('search') || '';
    const urlCategory = urlParams.get('category') || '';
    const subCategory = urlParams.get('sub') || '';
    
    let activeCategory = urlCategory;
    
    if (categorySelect && categorySelect.value && categorySelect.value !== urlCategory) {
        activeCategory = categorySelect.value;
    }
    
    if (categorySelect && activeCategory) {
        categorySelect.value = activeCategory;
    }

    const url = new URL(window.location);
    if (activeCategory) url.searchParams.set('category', activeCategory);
    else url.searchParams.delete('category');
    if (searchQuery) url.searchParams.set('search', searchQuery);
    if (subCategory) url.searchParams.set('sub', subCategory);
    window.history.pushState({}, '', url);

    let sortBy = sortSelect ? sortSelect.value : (urlParams.get('sort') || 'name_asc');
    let query = '';
    
    if (activeCategory) {
        query += `&category=${encodeURIComponent(activeCategory)}`;
    }
    
    // CRITICAL FIX: Send subcategory to backend if present
    if (subCategory) {
        query += `&subcategory=${encodeURIComponent(subCategory)}`;
    }
    
    if (searchQuery) {
        query += `&search=${encodeURIComponent(searchQuery)}`;
    }
    
    if (sortBy) {
        const [sortField, sortOrder] = sortBy === 'newest' ? ['createdAt', 'desc'] : sortBy.split('_');
        if (sortField && sortOrder) {
            query += `&sort=${sortField}&order=${sortOrder}`;
        }
    }

    container.innerHTML = '<p class="loading-message">Fetching products...</p>';
    if (paginationControls) paginationControls.innerHTML = '';

    const { items, totalPages, currentPage } = await fetchGridData('/products', page, ITEMS_PER_PAGE, query);
    
    renderProductGrid('products-container', items, 'products');
    if (paginationControls) {
        renderPagination('pagination-controls', totalPages, currentPage, 'products.html', loadProducts);
    }
}

// ====================================
// BUNDLES
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
// SINGLE PRODUCT PAGE (UPDATED: Unified dropdowns, Reviews near price, Rich text)
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

        const relatedContainer = document.getElementById('related-products-container');
        if (relatedContainer) {
            fetchRelatedProducts(product.category || 'general', product._id);
        }

    } catch (error) {
        console.error(`Error fetching product details for ID ${id}:`, error);
        container.innerHTML = `<p class="error-message">Could not load product details. ${error.message}. Please try again later.</p>`;
    }
}

async function fetchRelatedProducts(category, excludeId) {
    const container = document.getElementById('related-products-container');
    if (!container) return;

    try {
        const { items } = await fetchGridData('/products', 1, 20, `&exclude_id=${excludeId}&status=Active`);
        
        if (!items || items.length === 0) {
            container.innerHTML = '<p class="no-products-message">Check out our latest collection!</p>';
            return;
        }

        const shuffled = items.sort(() => 0.5 - Math.random());
        const randomSelection = shuffled.slice(0, 4);
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
    
    let displayPrice = product.price_egp || product.bundlePrice || 0;
    let hasVariants = false;
    
    if (product.variants && product.variants.length > 0) {
        hasVariants = true;
        displayPrice = product.variants[0].price;
    }

    const imageGalleryHTML = (product.imagePaths || []).map((path, idx) => 
        `<img src="${path}" class="thumbnail-image ${idx === 0 ? 'active' : ''}" onclick="swapImage(this)" alt="Thumbnail ${idx + 1}">`
    ).join('');

    // Fetch reviews count for the summary display
    let reviewSummaryHtml = '<div class="review-summary-placeholder"></div>';
    fetch(`${API_BASE_URL}/api/reviews/${product._id}`)
        .then(res => res.json())
        .then(reviews => {
            const reviewCount = reviews.length;
            const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : 0;
            const summaryDiv = document.querySelector('#dynamic-review-summary');
            if (summaryDiv && reviewCount > 0) {
                summaryDiv.innerHTML = `
                    <div class="product-review-stars" onclick="document.getElementById('reviews-section').scrollIntoView({ behavior: 'smooth' })">
                        ${renderStarsHtml(avgRating)}
                        <span class="review-count">(${reviewCount} reviews)</span>
                    </div>
                `;
            } else if (summaryDiv) {
                summaryDiv.innerHTML = `<div class="product-review-stars" onclick="document.getElementById('reviews-section').scrollIntoView({ behavior: 'smooth' })">⭐ 0 reviews</div>`;
            }
        })
        .catch(() => {});

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
                <h1 class="product-title-main">${escapeHtml(itemName)}</h1>
                <p class="product-category-subtle">${escapeHtml(itemCategory)}</p> 
                
                <p class="product-price-main" id="dynamic-price">${displayPrice.toFixed(2)} EGP</p>
                
                <!-- REVIEW SUMMARY - displayed right under price -->
                <div id="dynamic-review-summary" class="product-review-summary"></div>

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
                        <button class="buy-it-now-btn action-buy-now-btn">Buy it Now</button>
                    </div>
                ` : `<p class="stock-status out-of-stock">Out of Stock</p>`}

                <div class="product-description-section">
                    <h3>Description</h3>
                    <div class="rich-text-content">${(product.isBundle ? product.bundleDescription : product.description_en) || 'No description available.'}</div>
                    ${product.formattedDescription ? `<div class="formatted-desc rich-text-content">${product.formattedDescription}</div>` : ''}
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

        <!-- Reviews Section (full) -->
        <section class="reviews-section" id="reviews-section">
            <div class="reviews-header">
                <h3 class="reviews-title"><i class="fas fa-star"></i> Customer Reviews</h3>
                <button class="write-review-btn" id="write-review-btn" onclick="smoothScrollToReviews()">
                    <i class="fas fa-pen"></i> Write a Review
                </button>
            </div>

            <div class="review-form-wrapper" id="review-form-wrapper" style="display:none;">
                <h4 class="review-form-title">Share Your Experience</h4>
                <div class="review-form">
                    <div class="star-input-row">
                        <span class="star-label">Your Rating *</span>
                        <div class="star-input" id="star-input">
                            <i class="fas fa-star" data-value="1"></i>
                            <i class="fas fa-star" data-value="2"></i>
                            <i class="fas fa-star" data-value="3"></i>
                            <i class="fas fa-star" data-value="4"></i>
                            <i class="fas fa-star" data-value="5"></i>
                        </div>
                        <input type="hidden" id="review-rating" value="0">
                    </div>
                    <div class="review-form-row">
                        <input type="text" id="review-name" placeholder="Your Name *" class="review-input" maxlength="60">
                        <input type="email" id="review-email" placeholder="Email (not shown publicly)" class="review-input" maxlength="100">
                    </div>
                    <textarea id="review-comment" placeholder="Tell others about your experience with this product..." class="review-textarea" maxlength="800" rows="4"></textarea>
                    <div class="review-photo-row">
                        <label class="review-photo-label" for="review-photos">
                            <i class="fas fa-camera"></i> Add Photos (optional)
                        </label>
                        <input type="file" id="review-photos" accept="image/*" multiple style="display:none;" onchange="previewReviewPhotos(this)">
                        <div class="review-photo-previews" id="review-photo-previews"></div>
                    </div>
                    <div id="review-form-msg" class="review-form-msg" style="display:none;"></div>
                    <div class="review-form-actions">
                        <button class="submit-review-btn" onclick="submitReview()">Submit Review</button>
                        <button class="cancel-review-btn" onclick="toggleReviewForm()">Cancel</button>
                    </div>
                </div>
            </div>

            <div id="reviews-list">
                <p class="loading-message">Loading reviews...</p>
            </div>
        </section>
    `;

    if (hasVariants) renderVariantSelector(product.variants);
    renderProductOptions(product);
    if (product.isBundle) renderBundleItems(product);
    renderProductSpecifications(product);
    fetchAndRenderCare(product.category);
    fetchAndRenderReviews(product._id);

    const addBtn = document.getElementById('add-to-cart-btn');
    if (addBtn) addBtn.addEventListener('click', () => addToCartHandler(product));
    
    const buyNowBtn = document.querySelector('.buy-it-now-btn');
    if (buyNowBtn) buyNowBtn.addEventListener('click', () => buyNowHandler(product));
}

function renderStarsHtml(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= fullStars) stars += '<i class="fas fa-star star-filled"></i>';
        else if (i === fullStars + 1 && hasHalfStar) stars += '<i class="fas fa-star-half-alt star-filled"></i>';
        else stars += '<i class="fas fa-star star-empty"></i>';
    }
    return stars;
}

function smoothScrollToReviews() {
    const reviewsSection = document.getElementById('reviews-section');
    if (reviewsSection) {
        reviewsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        toggleReviewForm();
    }
}
window.smoothScrollToReviews = smoothScrollToReviews;

function renderProductSpecifications(product) {
    const section = document.getElementById('product-specifications-section');
    const container = document.getElementById('specifications-container');
    
    if (!section || !container) return;

    const specs = [];
    const category = product.category;

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
    }

    if (specs.length > 0) {
        section.style.display = 'block';
        container.innerHTML = `
            <div class="product-attributes-grid">
                ${specs.map(spec => `
                    <div class="attribute-chip">
                        <span class="attribute-icon">${spec.icon || '🔹'}</span>
                        <span class="attribute-label">${spec.label}:</span>
                        <span class="attribute-value">${escapeHtml(spec.value)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        section.style.display = 'none';
    }
}

function renderVariantSelector(variants) {
    const container = document.getElementById('variant-selector-container');
    if (!container) return;
    
    const variantType = variants[0]?.variantType || 'scent';
    const labelText = variantType === 'scent' ? 'Scent:' : 
                      variantType === 'size' ? 'Size:' : 
                      variantType === 'weight' ? 'Weight:' : 'Option:';
    
    container.innerHTML = `
        <div class="option-group variant-selector-group">
            <label for="variant-select" class="variant-label">${labelText}</label>
            <select id="variant-select" class="option-selector unified-dropdown">
                ${variants.map((v, i) => `
                    <option value="${v.variantName}" data-price="${v.price}" data-stock="${v.stock}" ${i === 0 ? 'selected' : ''}>
                        ${v.variantName} - ${v.price.toFixed(2)} EGP
                    </option>
                `).join('')}
            </select>
        </div>
    `;
    
    const variantSelect = document.getElementById('variant-select');
    const priceElement = document.getElementById('dynamic-price');
    
    if (variantSelect && priceElement) {
        variantSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const price = selectedOption.getAttribute('data-price');
            priceElement.textContent = `${parseFloat(price).toFixed(2)} EGP`;
        });
        
        const initialPrice = variantSelect.options[variantSelect.selectedIndex].getAttribute('data-price');
        priceElement.textContent = `${parseFloat(initialPrice).toFixed(2)} EGP`;
    }
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
                <select id="${id}" class="option-selector unified-dropdown product-custom-option" required>
                    <option value="">-- Select --</option>
                    ${opts.map(o => `<option value="${o}">${escapeHtml(o)}</option>`).join('')}
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
                    ${escapeHtml(item.subProductName)} (${item.size || ''}):
                </label>
                <select id="bundle-item-${i}" class="option-selector unified-dropdown bundle-item-select" required>
                    <option value="">-- Select a scent --</option>
                    ${scents.map(s => `<option value="${s.trim()}">${escapeHtml(s.trim())}</option>`).join('')}
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

function buyNowHandler(product) {
    const qty = parseInt(document.getElementById('quantity').value);
    let price = product.price_egp || product.bundlePrice || 0, variant = null;
    
    const vSelect = document.getElementById('variant-select');
    if (vSelect) {
        const opt = vSelect.options[vSelect.selectedIndex];
        price = parseFloat(opt.getAttribute('data-price'));
        variant = vSelect.value;
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
    window.location.href = 'checkout.html';
}

function addToCartHandler(product) {
    const qty = parseInt(document.getElementById('quantity').value);
    let price = product.price_egp || product.bundlePrice || 0, variant = null;
    
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

window.adjustQty = (d) => {
    const i = document.getElementById('quantity');
    let n = parseInt(i.value) + d;
    if(n < 1) n = 1;
    i.value = n;
};

function collectAllSelections(product) {
    const selections = [];
    let validationFailed = false;

    const optionSelectors = ['opt-scent', 'opt-shape', 'opt-type', 'opt-size'];

    optionSelectors.forEach(selectorId => {
        const selector = document.getElementById(selectorId);
        if (selector) {
            if (selector.required && !selector.value) {
                selector.focus();
                validationFailed = true;
            } else if (selector.value) {
                selections.push(`${selectorId.replace('-option', '')}: ${selector.value}`);
            }
        }
    });

    if (validationFailed) return null;

    if (product.isBundle) {
        const bundleItems = product.bundleItems || [];
        for (let i = 0; i < bundleItems.length; i++) {
            const selector = document.getElementById(`bundle-item-${i}`);
            
            if (!selector || !selector.value) {
                selector?.focus();
                return null;
            }
            
            selections.push(`${bundleItems[i].subProductName}: ${selector.value}`);
        }
    }

    return selections;
}

// ====================================
// CART MANAGEMENT
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

function getCartUniqueId(product) {
    if (product.customization && product.customization.length > 0) {
        const customizationString = Array.isArray(product.customization) 
            ? product.customization.sort().join('|')
            : product.customization;
        return `${product._id}_${customizationString}`;
    }
    if (product.variantName) {
        return `${product._id}_${product.variantName}`;
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
    showCartMessage(`${product.name} (x${product.quantity || 1}) added to cart!`);
}
window.addToCart = addToCart;

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
        if (cart.length === 0) {
            const checkoutForm = document.getElementById('checkout-form');
            if (checkoutForm) checkoutForm.style.display = 'none';
        }
    }
    
    showCartMessage('Item removed from cart');
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
            } else if (document.body.getAttribute('data-page') === 'checkout') {
                renderCheckoutSummary(document.getElementById('checkout-summary-container'));
                renderCheckoutCartItems();
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
            listEl.innerHTML = '<p class="empty-cart-message">Your cart is empty.</p>';
        } else {
            listEl.innerHTML = cart.map(item => `
                <div class="cart-item">
                    <img src="${item.imageUrl || 'assets/images/placeholder.jpg'}" style="width:50px; height:50px; border-radius:4px; object-fit:cover;">
                    
                    <div class="cart-item-details">
                        <div class="cart-item-name">${escapeHtml(item.name)}</div>
                        <span class="cart-item-variant">${escapeHtml(item.variantName || '')}</span>
                        <div class="cart-item-price">${item.quantity} x ${item.price} EGP</div>
                    </div>

                    <button class="remove-item-btn" onclick="removeItemFromCart('${getCartUniqueId(item)}')">&times;</button>
                </div>
            `).join('');
        }
    }
}

function showCartMessage(message) {
    const existingMessage = document.querySelector('.cart-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
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
// SHOP CART PAGE
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

    itemsContainer.innerHTML = cart.map(item => {
        const uniqueId = getCartUniqueId(item);
        const customizationDetail = item.customization ? 
            `<div class="cart-customization-detail"><small>Options: ${escapeHtml(item.customization.join(', '))}</small></div>` 
            : '';
        const itemImage = item.imageUrl || 'images/placeholder.jpg';

        return `
            <tr data-id="${uniqueId}">
                <td class="cart-product-col" data-label="Product">
                    <img src="${itemImage}" alt="${item.name}" class="cart-item-img">
                    <div>
                        <a href="product.html?id=${item._id}">${escapeHtml(item.name)}</a>
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
// CHECKOUT PAGE
// ====================================

async function setupCheckoutPage() {
    const summaryContainer = document.getElementById('checkout-summary-container');
    const checkoutForm = document.getElementById('checkout-form');
    const cartItemsContainer = document.getElementById('checkout-cart-items');
    
    if (cart.length === 0) {
        summaryContainer.innerHTML = '<p>Your cart is empty. <a href="products.html">Return to shopping.</a></p>';
        if (checkoutForm) checkoutForm.style.display = 'none';
        return;
    }
    
    renderCheckoutSummary(summaryContainer);
    renderCheckoutCartItems();
    
    await loadShippingCities(); 
    await checkAndApplyAutomaticDiscounts();

    const applyBtn = document.getElementById('apply-discount-btn');
    if (applyBtn) {
        applyBtn.replaceWith(applyBtn.cloneNode(true));
        const newBtn = document.getElementById('apply-discount-btn');
        newBtn.addEventListener('click', handleApplyDiscount);
    }

    if (checkoutForm) {
        checkoutForm.addEventListener('submit', processCheckout);
    }
}

function renderCheckoutSummary(container) {
    container.innerHTML = `
        <h3>Order Summary</h3>
        <div class="checkout-item-list">
            ${cart.map(item => `
                <p class="checkout-item">
                    ${escapeHtml(item.name)} x ${item.quantity} 
                    ${item.variantName ? `(${escapeHtml(item.variantName)})` : ''}
                    <span>${(item.price * item.quantity).toFixed(2)} EGP</span>
                </p>`).join('')}
        </div>
        <hr>
        <p class="checkout-summary-line">Subtotal: <span id="summary-subtotal">0.00 EGP</span></p>
        <p class="checkout-summary-line">Shipping: <span id="summary-shipping">Select City</span></p>
        <p class="checkout-summary-line" id="discount-row" style="display:none; color:green;">
            <span class="discount-label">Discount:</span>
            <span id="summary-discount">-0.00 EGP</span>
        </p>
        <p class="checkout-summary-line final-total">Total: <span id="summary-total">0.00 EGP</span></p>
    `;
    
    updateCheckoutTotals();
}

function updateCheckoutTotals() {
    const subtotal = getCartTotal();
 
    const citySelect = document.getElementById('city');
    let shippingFee = 0;
 
    if (subtotal >= 2000) {
        shippingFee = 0;
    } else if (citySelect && citySelect.options.length > 0 && citySelect.selectedIndex >= 0) {
        const selectedOption = citySelect.options[citySelect.selectedIndex];
        if (selectedOption && selectedOption.dataset.fee) {
            shippingFee = parseFloat(selectedOption.dataset.fee);
        }
    }
 
    let discountAmount = 0;
    let freeShipping = false;
 
    if (appliedDiscount) {
        if (appliedDiscount.isFreeShipping || appliedDiscount.type === 'free_shipping') {
            freeShipping = true;
            shippingFee = 0;
            discountAmount = 0;
        } else {
            discountAmount = appliedDiscount.discountAmount || 0;
        }
    }
 
    const total = Math.max(0, subtotal + shippingFee - discountAmount);
 
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

function renderCheckoutCartItems() {
    const container = document.getElementById('checkout-cart-items');
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = '<p class="empty-message">Your cart is empty.</p>';
        return;
    }

    container.innerHTML = cart.map(item => {
        const uniqueId = getCartUniqueId(item);
        
        const variantDisplay = item.variantName 
            ? `<span style="background:#f3f4f6; color:#374151; padding:2px 6px; border-radius:4px; font-size:0.8em; margin-left:5px; border:1px solid #e5e7eb;">${escapeHtml(item.variantName)}</span>` 
            : '';

        const customizationDetail = item.customization && item.customization.length > 0
            ? `<div class="cart-customization-detail"><small>Options: ${escapeHtml(item.customization.join(', '))}</small></div>` 
            : '';
            
        const itemImage = item.imageUrl || 'assets/images/placeholder.jpg';
        const itemTotal = (item.price * item.quantity).toFixed(2);

        return `
            <div class="checkout-cart-item" data-id="${uniqueId}">
                <div class="checkout-item-image">
                    <img src="${itemImage}" alt="${item.name}" loading="lazy">
                </div>
                <div class="checkout-item-details">
                    <h4>${escapeHtml(item.name)} ${variantDisplay}</h4>
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
    }).join();
}

async function processCheckout(e) {
    e.preventDefault();
    
    const checkoutForm = e.target;
    const formData = new FormData(checkoutForm);
    const totalAmount = getCartTotal();
    
    if (!formData.get('city')) {
        alert('Please select your city.');
        return;
    }
    const citySelect = document.getElementById('city');
    if (!citySelect || !citySelect.value) {
        alert('Please select your city before placing the order.');
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
        items: cart.map(item => ({
            productId: item._id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            variantName: item.variantName || null, 
            customization: item.customization || []
        })),
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
        alert('Error: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function loadShippingCities() {
    const citySelect = document.getElementById('city');
    if (!citySelect) return;

    try {
        citySelect.innerHTML = '<option value="">Loading cities...</option>';
        
        const response = await fetch(`${API_BASE_URL}/api/shipping-rates`);
        if (!response.ok) throw new Error('Failed to load cities');
        
        const rates = await response.json();
        
        citySelect.innerHTML = '<option value="">Select your city</option>';
        rates.forEach(rate => {
            const option = document.createElement('option');
            option.value = rate.city;
            option.textContent = rate.city;
            option.dataset.fee = rate.shippingFee; 
            citySelect.appendChild(option);
        });

        citySelect.addEventListener('change', updateCheckoutTotals);

    } catch (error) {
        console.error(error);
        citySelect.innerHTML = '<option value="">Error loading cities (Standard shipping applies)</option>';
    }
}

let appliedDiscount = null;
 
async function handleApplyDiscount() {
    const codeInput = document.getElementById('discount-code');
    const messageEl = document.getElementById('discount-message');
    const code = codeInput.value.trim().toUpperCase();
 
    if (!code) return;
 
    messageEl.textContent = 'Checking code...';
    messageEl.className = '';
 
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
                cartItems
            })
        });
 
        const data = await response.json();
 
        if (data.valid) {
            appliedDiscount = {
                ...data.discount,
                discountAmount: data.discountAmount
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

            const discountSection = document.querySelector('.discount-section');
            if (discountSection) {
                discountSection.innerHTML = `
                    <div class="auto-discount-banner">
                        🎉 ${best.message}
                    </div>
                `;
            }

            updateCheckoutTotals();

            const discountRow = document.getElementById('discount-row');
            if (discountRow) {
                const labelSpan = discountRow.querySelector('.discount-label');
                if (labelSpan) labelSpan.textContent = '';
            }

        }
    } catch (error) {
        console.error('Auto-discount check failed:', error);
    }
}

window.swapImage = function(imgElement) {
    const mainImage = document.getElementById('main-display-image');
    mainImage.src = imgElement.src;
    document.querySelectorAll('.thumbnail-image').forEach(thumb => thumb.classList.remove('active'));
    imgElement.classList.add('active');
}

async function fetchAndRenderCare(categoryName) {
    const section = document.getElementById('care-instructions-section');
    const container = document.getElementById('care-instructions-container');
    
    if (!section || !container || !categoryName) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/care`);
        if (!response.ok) return;

        const allInstructions = await response.json();

        const relevantInstructions = allInstructions.filter(
            item => item.category.toLowerCase() === categoryName.toLowerCase()
        );

        if (relevantInstructions.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        container.innerHTML = relevantInstructions.map(item => `
            <div class="care-card">
                <div class="care-icon"><i class="fas fa-sparkles"></i></div>
                <div class="care-content">
                    <h4>${escapeHtml(item.careTitle)}</h4>
                    <div class="rich-text-content">${item.careContent}</div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error("Error loading care instructions:", error);
        section.style.display = 'none';
    }
}

// ── REVIEWS ────────────────────────────────────────────────────────────────────

let _currentProductId = null;
let _selectedRating = 0;
let _reviewPhotoFiles = [];

async function fetchAndRenderReviews(productId) {
    _currentProductId = productId;
    const list = document.getElementById('reviews-list');
    if (!list) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/reviews/${productId}`);
        const reviews = res.ok ? await res.json() : [];
        renderReviewsList(reviews);
    } catch (e) {
        list.innerHTML = '<p class="no-reviews-msg">Could not load reviews.</p>';
    }
}

function renderReviewsList(reviews) {
    const list = document.getElementById('reviews-list');
    if (!list) return;

    if (!reviews || reviews.length === 0) {
        list.innerHTML = '<p class="no-reviews-msg">No reviews yet — be the first to share your experience! ✨</p>';
        return;
    }

    const avg = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
    const starsHTML = (n) => [1,2,3,4,5].map(i =>
        `<i class="fas fa-star ${i <= Math.round(n) ? 'star-filled' : 'star-empty'}"></i>`
    ).join('');

    list.innerHTML = `
        <div class="reviews-summary">
            <div class="reviews-avg-score">${avg}</div>
            <div>
                <div class="reviews-avg-stars">${starsHTML(avg)}</div>
                <div class="reviews-count">${reviews.length} review${reviews.length !== 1 ? 's' : ''}</div>
            </div>
        </div>
        <div class="reviews-list-inner">
            ${reviews.map(r => `
                <div class="review-card">
                    <div class="review-card-top">
                        <div class="reviewer-avatar">${(r.name || 'A')[0].toUpperCase()}</div>
                        <div class="reviewer-meta">
                            <span class="reviewer-name">${escapeHtml(r.name || 'Anonymous')}</span>
                            <div class="review-stars">${starsHTML(r.rating)}</div>
                        </div>
                        <span class="review-date">${new Date(r.createdAt || Date.now()).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})}</span>
                    </div>
                    ${r.comment ? `<p class="review-comment">${escapeHtml(r.comment)}</p>` : ''}
                    ${r.photos && r.photos.length > 0 ? `
                        <div class="review-photos">
                            ${r.photos.map(p => `<img src="${p}" class="review-photo-thumb" onclick="openReviewPhoto('${p}')" alt="Review photo">`).join('')}
                        </div>` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function toggleReviewForm() {
    const wrapper = document.getElementById('review-form-wrapper');
    if (!wrapper) return;
    const isHidden = wrapper.style.display === 'none';
    wrapper.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setupStarInput();
    }
}
window.toggleReviewForm = toggleReviewForm;

function setupStarInput() {
    const stars = document.querySelectorAll('#star-input .fa-star');
    stars.forEach(star => {
        star.addEventListener('mouseover', () => highlightStars(+star.dataset.value));
        star.addEventListener('mouseout', () => highlightStars(_selectedRating));
        star.addEventListener('click', () => {
            _selectedRating = +star.dataset.value;
            document.getElementById('review-rating').value = _selectedRating;
            highlightStars(_selectedRating);
        });
    });
}

function highlightStars(n) {
    document.querySelectorAll('#star-input .fa-star').forEach(s => {
        s.classList.toggle('star-selected', +s.dataset.value <= n);
    });
}

function previewReviewPhotos(input) {
    _reviewPhotoFiles = Array.from(input.files).slice(0, 4);
    const container = document.getElementById('review-photo-previews');
    if (!container) return;
    container.innerHTML = _reviewPhotoFiles.map((f, i) => {
        const url = URL.createObjectURL(f);
        return `<div class="preview-thumb-wrap">
            <img src="${url}" class="preview-thumb">
            <button class="remove-photo-btn" onclick="removeReviewPhoto(${i})">×</button>
        </div>`;
    }).join('');
}
window.previewReviewPhotos = previewReviewPhotos;

function removeReviewPhoto(idx) {
    _reviewPhotoFiles.splice(idx, 1);
    const dt = new DataTransfer();
    _reviewPhotoFiles.forEach(f => dt.items.add(f));
    document.getElementById('review-photos').files = dt.files;
    previewReviewPhotos({ files: dt.files });
}
window.removeReviewPhoto = removeReviewPhoto;

async function submitReview() {
    const name = document.getElementById('review-name')?.value.trim();
    const email = document.getElementById('review-email')?.value.trim();
    const comment = document.getElementById('review-comment')?.value.trim();
    const rating = +document.getElementById('review-rating')?.value;
    const msgEl = document.getElementById('review-form-msg');

    const showMsg = (text, ok) => {
        if (!msgEl) return;
        msgEl.style.display = 'block';
        msgEl.textContent = text;
        msgEl.className = 'review-form-msg ' + (ok ? 'msg-success' : 'msg-error');
    };

    if (!name) return showMsg('Please enter your name.', false);
    if (!rating) return showMsg('Please select a star rating.', false);
    if (!comment) return showMsg('Please write a comment.', false);

    const btn = document.querySelector('.submit-review-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

    try {
        let uploadedPhotos = [];
        for (const file of _reviewPhotoFiles) {
            const fd = new FormData();
            fd.append('image', file);
            const r = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', body: fd });
            if (r.ok) {
                const d = await r.json();
                uploadedPhotos.push(d.imageUrl);
            }
        }

        const res = await fetch(`${API_BASE_URL}/api/reviews/${_currentProductId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, rating, comment, photos: uploadedPhotos })
        });

        if (res.ok) {
            showMsg('Thank you for your review! 🎉', true);
            document.getElementById('review-name').value = '';
            document.getElementById('review-email').value = '';
            document.getElementById('review-comment').value = '';
            document.getElementById('review-rating').value = '0';
            document.getElementById('review-photo-previews').innerHTML = '';
            _selectedRating = 0;
            _reviewPhotoFiles = [];
            highlightStars(0);
            setTimeout(() => {
                toggleReviewForm();
                fetchAndRenderReviews(_currentProductId);
            }, 1800);
        } else {
            const err = await res.json();
            showMsg(err.message || 'Failed to submit. Please try again.', false);
        }
    } catch (e) {
        showMsg('Network error. Please try again.', false);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Submit Review'; }
    }
}
window.submitReview = submitReview;

function openReviewPhoto(url) {
    const overlay = document.createElement('div');
    overlay.className = 'review-photo-overlay';
    overlay.innerHTML = `<div class="review-photo-overlay-inner">
        <img src="${url}" class="review-photo-full">
        <button class="close-overlay-btn" onclick="this.closest('.review-photo-overlay').remove()">×</button>
    </div>`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
}
window.openReviewPhoto = openReviewPhoto;

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}