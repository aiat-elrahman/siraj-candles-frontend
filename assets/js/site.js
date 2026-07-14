const API_BASE_URL = 'https://siraj-backend.onrender.com'; 
const ITEMS_PER_PAGE = 12; 

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadCartFromStorage();
    loadHeroSettings();
    loadSiteSettings();


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
            case 'order-tracking':
                 break;
            case 'stores':
            setupStoresPage(); 
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
// Order Tracking Form Logic
    const trackingForm = document.getElementById('order-tracking-form');
    if (trackingForm) {
        trackingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const phone = document.getElementById('tracking-phone').value.trim().replace(/[\s\-]/g, '');
            const resultDiv = document.getElementById('tracking-result');
            
            if (phone.length < 8) {
                resultDiv.innerHTML = '<p class="error-message">Please enter a valid phone number.</p>';
                resultDiv.style.display = 'block';
                return;
            }
            
            resultDiv.innerHTML = '<p class="loading-message">Searching for your orders...</p>';
            resultDiv.style.display = 'block';
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/orders/track/${encodeURIComponent(phone.replace(/\+/g, ''))}`);
                const orders = await response.json();
                
                if (!orders || orders.length === 0) {
                    resultDiv.innerHTML = '<p class="empty-message">No orders found for this phone number.</p>';
                } else {
                   resultDiv.innerHTML = orders.map(o => `
    <div class="tracking-order-card">
        <div class="tracking-order-header">
            <span class="tracking-order-id">Order #${o._id.slice(-8)}</span>
            <span class="order-status-badge status-${o.status.toLowerCase()}">${o.status}</span>
        </div>
        <p class="tracking-order-meta">📅 ${new Date(o.createdAt).toLocaleDateString('en-EG', { year:'numeric', month:'long', day:'numeric' })}</p>
        ${o.items && o.items.length > 0 ? `
        <div class="tracking-order-items">
            ${o.items.map(item => `
                <div class="tracking-order-item">• ${escapeHtml(item.name)} × ${item.quantity}</div>
            `).join('')}
        </div>` : ''}
        <p class="tracking-order-total">Total: ${o.totalAmount.toFixed(2)} EGP</p>
    </div>
`).join('');
                }
            } catch (err) {
                resultDiv.innerHTML = '<p class="error-message">Could not connect to tracking server. Please try again.</p>';
            }
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
            if(dropdown) dropdown.style.display = dropdown.style.display === 'flex' ? 'none' : 'flex';
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
        const onSale = !isBundle && item.salePrice && item.salePrice < itemPrice;
        
        // Stock Logic
        let isOutOfStock = false;
        let lowStockCount = null;

        if (!isBundle) {
            // Check variants if they exist, otherwise check global stock
            if (item.variants && item.variants.length > 0) {
                const totalVariantStock = item.variants.reduce((sum, v) => sum + v.stock, 0);
                isOutOfStock = totalVariantStock <= 0;
            } else {
                isOutOfStock = item.stock <= 0;
                if (item.stock > 0 && item.stock <= 5) {
                    lowStockCount = item.stock;
                }
            }
        }
    
    return `
    <a href="product.html?id=${item._id}" class="product-card" ${isOutOfStock ? 'style="opacity: 0.6; pointer-events: none;"' : ''}>
        ${isOutOfStock ? `<span class="oos-badge" style="background: var(--error); color: white;">Out of Stock</span>` : ''}
        ${!isOutOfStock && lowStockCount ? `<span class="oos-badge" style="background: #f59e0b; color: white;">Only ${lowStockCount} Left!</span>` : ''}
        ${onSale ? `<span class="sale-badge">SALE</span>` : ''}
        <div>
            <img src="${itemImage}" alt="${itemName}" loading="lazy">
        </div>
            <div class="product-info-minimal">
                <p class="product-title">${escapeHtml(itemName)}</p>
                <p class="product-price">${onSale
                    ? `<span class="price-original">${itemPrice.toFixed(2)} EGP</span> <span class="price-sale">${item.salePrice.toFixed(2)} EGP</span>`
                    : `${itemPrice.toFixed(2)} EGP`}</p>
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
 
    html += `</div></div>
    <a href="bundles.html" class="mobile-nav-link">Bundles</a>
    <a href="order-tracking.html" class="mobile-nav-link">Track Order</a>
</nav>`;
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

let heroCarouselTimer = null;

async function loadHeroSettings() {
    const heroSection = document.getElementById('dynamic-hero');
    if (!heroSection) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/settings/hero`);
        const heroData = await response.json();

        // Normalize: support both the new { slides: [...] } shape and the
        // legacy single-slide shape { backgroundImage, title, subtitle, buttonText, buttonLink }
        let slides = Array.isArray(heroData.slides) && heroData.slides.length > 0
            ? heroData.slides
            : [heroData];

        slides = slides.filter(s => s && (s.backgroundImage || s.title));
        if (slides.length === 0) throw new Error('No hero slides configured');

        renderHeroCarousel(heroSection, slides, heroData.autoplaySpeed || 5000);

    } catch (error) {
        console.error('Failed to load hero settings:', error);
        heroSection.style.backgroundImage = "url('https://res.cloudinary.com/dvr195vfw/image/upload/v1776209850/Gemini_Generated_Image__3_bylucb.png')";
        heroSection.style.backgroundSize = 'cover';
        heroSection.style.backgroundPosition = 'center';
    }
}

function renderHeroCarousel(heroSection, slides, autoplaySpeed) {
    heroSection.classList.add('hero-carousel');
    heroSection.innerHTML = `
        <div class="hero-slides-track">
            ${slides.map((s, i) => `
                <div class="hero-slide ${i === 0 ? 'active' : ''}" style="background-image:url('${s.backgroundImage || ''}')">
                    <div class="hero-content">
                        ${s.title ? `<h1 class="hero-title">${escapeHtml(s.title)}</h1>` : ''}
                        ${s.subtitle ? `<p class="hero-subtitle">${escapeHtml(s.subtitle)}</p>` : ''}
                        <a href="${s.buttonLink || '/products.html'}" class="shop-now-btn">${escapeHtml(s.buttonText || 'Shop Now')}</a>
                    </div>
                </div>
            `).join('')}
        </div>
        ${slides.length > 1 ? `
        <button class="hero-arrow hero-arrow--prev" aria-label="Previous slide"><i class="fas fa-chevron-left"></i></button>
        <button class="hero-arrow hero-arrow--next" aria-label="Next slide"><i class="fas fa-chevron-right"></i></button>
        <div class="hero-dots">
            ${slides.map((_, i) => `<button class="hero-dot ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Go to slide ${i + 1}"></button>`).join('')}
        </div>` : ''}
    `;

    if (slides.length <= 1) return;

    let current = 0;
    const slideEls = heroSection.querySelectorAll('.hero-slide');
    const dotEls = heroSection.querySelectorAll('.hero-dot');

    const goTo = (index) => {
        slideEls[current].classList.remove('active');
        dotEls[current].classList.remove('active');
        current = (index + slides.length) % slides.length;
        slideEls[current].classList.add('active');
        dotEls[current].classList.add('active');
    };

    const startAutoplay = () => {
        clearInterval(heroCarouselTimer);
        heroCarouselTimer = setInterval(() => goTo(current + 1), autoplaySpeed);
    };

    heroSection.querySelector('.hero-arrow--prev').addEventListener('click', () => { goTo(current - 1); startAutoplay(); });
    heroSection.querySelector('.hero-arrow--next').addEventListener('click', () => { goTo(current + 1); startAutoplay(); });
    dotEls.forEach(dot => dot.addEventListener('click', () => { goTo(parseInt(dot.dataset.index)); startAutoplay(); }));

    heroSection.addEventListener('mouseenter', () => clearInterval(heroCarouselTimer));
    heroSection.addEventListener('mouseleave', startAutoplay);

    startAutoplay();
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
       query += `&sub=${encodeURIComponent(subCategory)}`;
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
        window.SirajTracking?.trackViewContent(product);

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
    

    let itemStock = product.stock || 0;
let isOutOfStock = false;

if (product.variants && product.variants.length > 0) {
    const totalVariantStock = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    isOutOfStock = totalVariantStock <= 0;
    itemStock = totalVariantStock;
} else {
    isOutOfStock = itemStock <= 0;
}
    
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
                
               <p class="product-price-main" id="dynamic-price">
                    ${!product.isBundle && product.salePrice && product.salePrice < displayPrice && !hasVariants
                        ? `<span class="price-original">${displayPrice.toFixed(2)} EGP</span> <span class="price-sale">${product.salePrice.toFixed(2)} EGP</span> <span class="sale-badge sale-badge--inline">SALE</span>`
                        : `${displayPrice.toFixed(2)} EGP`}
                </p>
${product.isBundle && product.bundleOriginalPrice > displayPrice ? `
    <p class="bundle-savings-line">
        <span class="bundle-original-price">${product.bundleOriginalPrice.toFixed(2)} EGP</span>
        <span class="bundle-savings-badge">Save ${(product.bundleOriginalPrice - displayPrice).toFixed(2)} EGP</span>
    </p>
` : ''}
                
                <!-- REVIEW SUMMARY - displayed right under price -->
                <div id="dynamic-review-summary" class="product-review-summary"></div>

                ${!isOutOfStock ? `
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
                        <input type="email" id="review-email" placeholder="Email (required, not shown publicly)" class="review-input" maxlength="100">
<input type="tel" id="review-phone" placeholder="Phone Number (required, not shown publicly)" class="review-input" maxlength="20">
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
                      variantType === 'size'  ? 'Size:'  : 
                      variantType === 'weight'? 'Weight:': 'Option:';
    
    container.innerHTML = `
        <div class="option-group variant-selector-group">
            <label for="variant-select" class="variant-label">${labelText}</label>
            <select id="variant-select" class="option-selector unified-dropdown">
                ${variants.map((v, i) => {
                    const outOfStock = (v.stock !== undefined && v.stock <= 0);
                    return `<option value="${v.variantName}" data-price="${v.price}" data-stock="${v.stock}"
                        ${outOfStock ? 'disabled' : ''}
                        ${!outOfStock && i === 0 ? 'selected' : ''}>
                        ${v.variantName}${outOfStock ? ' — Out of Stock' : ''}
                    </option>`;
                }).join('')}
            </select>
        </div>
    `;
    
    const variantSelect = document.getElementById('variant-select');
    const priceElement  = document.getElementById('dynamic-price');
    const qtyInput      = document.getElementById('quantity'); // ← declared ONCE here

    if (variantSelect) {
        variantSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            if (!selectedOption) return;
            
            const price = selectedOption.getAttribute('data-price');
            if (price && priceElement) priceElement.textContent = `${parseFloat(price).toFixed(2)} EGP`;
            
            const stock = parseInt(selectedOption.getAttribute('data-stock')) || 0;
            if (qtyInput) {
                qtyInput.setAttribute('max', stock);
                if (parseInt(qtyInput.value) > stock) {
                    qtyInput.value = stock > 0 ? stock : 1;
                }
            }
        });

        // Set initial price and stock from the first selected option
        if (variantSelect.selectedIndex >= 0 && variantSelect.options[variantSelect.selectedIndex]) {
            const initialOpt   = variantSelect.options[variantSelect.selectedIndex];
            const initialPrice = initialOpt.getAttribute('data-price');
            const initialStock = initialOpt.getAttribute('data-stock');
            
            if (initialPrice && priceElement) priceElement.textContent = `${parseFloat(initialPrice).toFixed(2)} EGP`;
            if (initialStock && qtyInput) qtyInput.setAttribute('max', initialStock);
        }

        // Override with first AVAILABLE (non-disabled) option's stock
        // This handles the case where the first option is out of stock
        const firstAvailableOpt = Array.from(variantSelect.options).find(o => !o.disabled);
        if (firstAvailableOpt && qtyInput) {
            const initStock = parseInt(firstAvailableOpt.getAttribute('data-stock')) || 0;
            if (initStock > 0) qtyInput.setAttribute('max', initStock);
        }
    }
}

function renderProductOptions(product) {
    const container = document.getElementById('options-container');
    if(!container) return;
    
   
const createSelect = (label, optionsStr, id) => {
    if (!optionsStr) return '';
    const opts = optionsStr.split(',').map(s=>s.trim()).filter(Boolean);
    if(opts.length === 0) return '';
    
    // If only one option, show it as a static label instead of a dropdown
    if(opts.length === 1) {
        return `
            <div class="option-group">
                <label>${label}:</label>
                <p class="single-option-display">${escapeHtml(opts[0])}</p>
                <input type="hidden" id="${id}" value="${escapeHtml(opts[0])}">
            </div>
        `;
    }
    
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
    const qtyInput = document.getElementById('quantity');
    const qty = parseInt(qtyInput.value);
    const maxStock = parseInt(qtyInput.getAttribute('max')) || 999;

    let price = (product.salePrice && product.salePrice < (product.price_egp || Infinity)) ? product.salePrice : (product.price_egp || product.bundlePrice || 0);
    let variant = null;
    
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
        maxStock: maxStock, // <-- NEW: Save the stock limit to the cart
        customization: collectAllSelections(product) || []
    };
    addToCart(cartItem);
    window.location.href = 'checkout.html';
}

function addToCartHandler(product) {
    const qtyInput = document.getElementById('quantity');
    const qty = parseInt(qtyInput.value);
    const maxStock = parseInt(qtyInput.getAttribute('max')) || 999;

    let price = (product.salePrice && product.salePrice < (product.price_egp || Infinity)) ? product.salePrice : (product.price_egp || product.bundlePrice || 0);
    let variant = null;
    
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
        maxStock: maxStock, // <-- NEW: Save the stock limit to the cart
        customization: collectAllSelections(product) || []
    };
    addToCart(cartItem);

    if (product.pairedProduct) {
        setTimeout(() => showPairingPopup(product.pairedProduct), 500);
    }
}
window.adjustQty = (d) => {
    const i = document.getElementById('quantity');
    if (!i) return;
    
    let max = parseInt(i.getAttribute('max'));
    if (isNaN(max)) max = 999; // Fallback for bundles
    
    let n = parseInt(i.value) + d;
    
    if (n < 1) n = 1;
    if (n > max) {
        n = max;
        // Flash a warning using your existing toast message
        showCartMessage(`Only ${max} available in stock!`);
    }
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
let siteFreeGiftSettings = null; // { enabled, threshold, giftProducts: [...] }
let freeGiftDeclined = false;    // true after the customer manually removes their gift

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
    if (product.isFreeGift) {
        return `${product._id}_freegift`;
    }
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
        // Calculate what the new quantity WOULD be after this click
        const proposedQty = existingItem.quantity + (product.quantity || 1);
        const max = product.maxStock || existingItem.maxStock || 999;
        
        // Block it if it exceeds stock
        if (proposedQty > max) {
            showCartMessage(`Sorry, we only have ${max} of this item in stock!`);
            existingItem.quantity = max; // Cap it at the maximum
        } else {
            existingItem.quantity = proposedQty;
            showCartMessage(`${product.name} (x${product.quantity || 1}) added to cart!`);
        }
    } else {
        // Block it if the initial addition exceeds stock
        const max = product.maxStock || 999;
        let qtyToAdd = product.quantity || 1;
        
        if (qtyToAdd > max) {
            showCartMessage(`Sorry, we only have ${max} available!`);
            qtyToAdd = max;
        } else {
            showCartMessage(`${product.name} (x${qtyToAdd}) added to cart!`);
        }

        cart.push({ 
            ...product, 
            cartItemId: uniqueId, 
            quantity: qtyToAdd,
            maxStock: max // Ensure the cart remembers the limit for later
        });
    }
    
    window.SirajTracking?.trackAddToCart(product);
    saveCartToStorage();
    updateCartUI();
}
window.addToCart = addToCart;

function removeItemFromCart(id) {
    const removedItem = cart.find(item => getCartUniqueId(item) === id);
    if (removedItem && removedItem.isFreeGift) freeGiftDeclined = true;
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
        let newQuantity = parseInt(quantity);
        const max = item.maxStock || 999;
        
        // <-- NEW: Hard stop if they hit the + button too many times
        if (newQuantity > max) {
            showCartMessage(`Only ${max} available in stock!`);
            newQuantity = max; 
        }
        
        if (newQuantity > 0 && !isNaN(newQuantity)) {
            item.quantity = newQuantity;
            saveCartToStorage();
            updateCartUI();
            
            if (document.body.getAttribute('data-page') === 'shopcart') {
                renderShopCartPage();
            } else if (document.body.getAttribute('data-page') === 'checkout') {
                renderCheckoutSummary(document.getElementById('checkout-summary-container'));
                renderCheckoutCartItems();
                updateCheckoutTotals(); // Ensures totals update immediately
            }
        } else if (newQuantity <= 0) {
            removeItemFromCart(id);
        }
    }
}
window.updateItemQuantity = updateItemQuantity;
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
                        <div class="cart-item-price">${item.isFreeGift ? '<span class="free-gift-tag">🎁 FREE GIFT</span>' : `${item.quantity} x ${item.price} EGP`}</div>
                    </div>

                    <button class="remove-item-btn" onclick="removeItemFromCart('${getCartUniqueId(item)}')">&times;</button>
                </div>
            `).join('');
        }
    }

    updateFreeGiftBar();
}

// ── Free Gift Progress Bar ─────────────────────────────────────────────────
function ensureFreeGiftBarMarkup() {
    if (document.getElementById('free-gift-bar')) return;
    const summary = document.querySelector('#cart-dropdown .cart-summary');
    if (!summary) return;
    const bar = document.createElement('div');
    bar.id = 'free-gift-bar';
    bar.className = 'free-gift-bar';
    bar.style.display = 'none';
    bar.innerHTML = `
        <p class="free-gift-message"></p>
        <div class="free-gift-track"><div class="free-gift-fill"></div></div>
    `;
    summary.insertAdjacentElement('afterend', bar);
}

function updateFreeGiftBar() {
    ensureFreeGiftBarMarkup();
    const bar = document.getElementById('free-gift-bar');
    const fg = siteFreeGiftSettings;

    if (!bar) return;
    if (!fg || !fg.enabled || !fg.threshold || !(fg.giftProducts && fg.giftProducts.length)) {
        bar.style.display = 'none';
        return;
    }

    bar.style.display = '';
    const paidSubtotal = cart.filter(i => !i.isFreeGift).reduce((s, i) => s + (i.price * i.quantity), 0);
    const remaining = fg.threshold - paidSubtotal;
    const pct = Math.max(0, Math.min(100, (paidSubtotal / fg.threshold) * 100));

    const fill = bar.querySelector('.free-gift-fill');
    const msg = bar.querySelector('.free-gift-message');
    if (fill) fill.style.width = pct + '%';

    if (remaining > 0) {
        bar.classList.remove('unlocked');
        freeGiftDeclined = false; // dropped below threshold, offer again if they cross it later
        if (msg) msg.textContent = `Add ${remaining.toFixed(0)} EGP more to unlock a free gift 🎁`;
        const hadGift = cart.some(i => i.isFreeGift);
        if (hadGift) {
            cart = cart.filter(i => !i.isFreeGift);
            saveCartToStorage();
        }
    } else {
        bar.classList.add('unlocked');
        if (msg) msg.textContent = `🎉 You've unlocked a free gift!`;
        if (!freeGiftDeclined) ensureFreeGiftInCart(fg.giftProducts);
    }
}

function ensureFreeGiftInCart(giftProducts) {
    if (cart.some(i => i.isFreeGift)) return;
    if (giftProducts.length === 1) {
        addFreeGiftToCart(giftProducts[0]);
    } else {
        showGiftChoiceModal(giftProducts);
    }
}

function addFreeGiftToCart(gift) {
    if (cart.some(i => i.isFreeGift)) return;
    cart.push({
        _id: gift._id,
        name: gift.name_en,
        category: gift.category || '',
        price: 0,
        quantity: 1,
        imageUrl: gift.imagePaths?.[0],
        variantName: null,
        isFreeGift: true,
        maxStock: 999,
        customization: []
    });
    saveCartToStorage();
    updateCartUI();
    showCartMessage(`🎁 ${gift.name_en} added as your free gift!`);
}

function showGiftChoiceModal(giftProducts) {
    document.querySelectorAll('.branded-modal-overlay').forEach(el => el.remove());
    const overlay = document.createElement('div');
    overlay.className = 'branded-modal-overlay';
    overlay.innerHTML = `
        <div class="branded-modal gift-choice-popup">
            <button class="branded-modal-close" aria-label="Close">&times;</button>
            <h3 class="branded-modal-title">🎁 Choose Your Free Gift</h3>
            <div class="gift-choice-grid">
                ${giftProducts.map(g => `
                    <button type="button" class="gift-choice-card" data-id="${g._id}">
                        <img src="${g.imagePaths?.[0] || 'assets/images/placeholder.jpg'}" alt="${escapeHtml(g.name_en || '')}">
                        <span>${escapeHtml(g.name_en || '')}</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('.branded-modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelectorAll('.gift-choice-card').forEach(btn => {
        btn.addEventListener('click', () => {
            const gift = giftProducts.find(g => g._id === btn.dataset.id);
            overlay.remove();
            if (gift) addFreeGiftToCart(gift);
        });
    });
    document.body.appendChild(overlay);
}

// ── Product Pairing Popup ────────────────────────────────────────────────
function showPairingPopup(paired) {
    if (!paired || !paired._id) return;
    const sessionKey = 'pairingShown_' + paired._id;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');

    const hasSale = paired.salePrice && paired.salePrice < paired.price_egp;
    const price = hasSale ? paired.salePrice : (paired.price_egp || 0);

    document.querySelectorAll('.branded-modal-overlay').forEach(el => el.remove());
    const overlay = document.createElement('div');
    overlay.className = 'branded-modal-overlay';
    overlay.innerHTML = `
        <div class="branded-modal pairing-popup">
            <button class="branded-modal-close" aria-label="Close">&times;</button>
            <h3 class="branded-modal-title">Pairs Beautifully With...</h3>
            <div class="pairing-product-preview">
                <img src="${paired.imagePaths?.[0] || 'assets/images/placeholder.jpg'}" alt="${escapeHtml(paired.name_en || '')}">
                <div class="pairing-product-info">
                    <p class="pairing-product-name">${escapeHtml(paired.name_en || '')}</p>
                    <p class="pairing-product-price">
                        ${hasSale
                            ? `<span class="price-original">${paired.price_egp.toFixed(2)} EGP</span> <span class="price-sale">${paired.salePrice.toFixed(2)} EGP</span>`
                            : `${price.toFixed(2)} EGP`}
                    </p>
                </div>
            </div>
            <div class="branded-modal-actions">
                <button type="button" class="branded-modal-btn branded-modal-btn--ghost" data-action="cancel">No Thanks</button>
                <button type="button" class="branded-modal-btn branded-modal-btn--primary" data-action="confirm">Add to Cart</button>
            </div>
        </div>
    `;
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('.branded-modal-close').addEventListener('click', close);
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
    overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => {
        addToCart({
            _id: paired._id,
            name: paired.name_en,
            category: paired.category || '',
            price: price,
            quantity: 1,
            imageUrl: paired.imagePaths?.[0],
            variantName: null,
            maxStock: paired.stock || 999,
            customization: []
        });
        close();
    });
    document.body.appendChild(overlay);
}

// ── Reusable Branded Modal (replaces plain browser alerts) ─────────────────
function showBrandedModal({ title = '', message = '', type = 'info', confirmText = 'OK', onConfirm = null, cancelText = null, onCancel = null } = {}) {
    document.querySelectorAll('.branded-modal-overlay').forEach(el => el.remove());
    const overlay = document.createElement('div');
    overlay.className = 'branded-modal-overlay';
    overlay.innerHTML = `
        <div class="branded-modal branded-modal--${type}">
            <button class="branded-modal-close" aria-label="Close">&times;</button>
            ${title ? `<h3 class="branded-modal-title">${escapeHtml(title)}</h3>` : ''}
            <p class="branded-modal-message">${escapeHtml(message)}</p>
            <div class="branded-modal-actions">
                ${cancelText ? `<button type="button" class="branded-modal-btn branded-modal-btn--ghost" data-action="cancel">${escapeHtml(cancelText)}</button>` : ''}
                <button type="button" class="branded-modal-btn branded-modal-btn--primary" data-action="confirm">${escapeHtml(confirmText)}</button>
            </div>
        </div>
    `;
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('.branded-modal-close').addEventListener('click', close);
    overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => { close(); if (onConfirm) onConfirm(); });
    const cancelBtn = overlay.querySelector('[data-action="cancel"]');
    if (cancelBtn) cancelBtn.addEventListener('click', () => { close(); if (onCancel) onCancel(); });
    document.body.appendChild(overlay);
    return overlay;
}
window.showBrandedModal = showBrandedModal;

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
                <td data-label="Price">${item.isFreeGift ? '<span class="free-gift-tag">🎁 FREE</span>' : item.price.toFixed(2) + ' EGP'}</td>
                <td data-label="Quantity">
                    ${item.isFreeGift ? `<span class="free-gift-tag">Qty: 1</span>` : `
                    <div class="quantity-controls">
                        <button class="quantity-btn minus" onclick="updateItemQuantity('${uniqueId}', ${item.quantity - 1})">-</button>
                        <input type="number" value="${item.quantity}" min="1" class="item-quantity-input" 
                               onchange="updateItemQuantity('${uniqueId}', this.value)">
                        <button class="quantity-btn plus" onclick="updateItemQuantity('${uniqueId}', ${item.quantity + 1})">+</button>
                    </div>`}
                </td>
                <td data-label="Total">${item.isFreeGift ? '<span class="free-gift-tag">🎁 FREE</span>' : (item.price * item.quantity).toFixed(2) + ' EGP'}</td>
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
    window.SirajTracking?.trackBeginCheckout(cart, getCartTotal());

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
                    <div class="checkout-item-price">${item.isFreeGift ? '<span class="free-gift-tag">🎁 FREE</span>' : item.price.toFixed(2) + ' EGP each'}</div>
                </div>
                <div class="checkout-item-controls">
                    ${item.isFreeGift ? `<span class="free-gift-tag">Qty: 1</span>` : `
                    <div class="quantity-controls">
                        <button class="quantity-btn minus" type="button" onclick="updateItemQuantity('${uniqueId}', ${item.quantity - 1})">-</button>
                        <input type="number" value="${item.quantity}" min="1" class="item-quantity-input" 
                               onchange="updateItemQuantity('${uniqueId}', this.value)">
                        <button class="quantity-btn plus" type="button" onclick="updateItemQuantity('${uniqueId}', ${item.quantity + 1})">+</button>
                    </div>`}
                    <div class="checkout-item-total">${item.isFreeGift ? '<span class="free-gift-tag">🎁 FREE</span>' : itemTotal + ' EGP'}</div>
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
    const cartSubtotal = getCartTotal();
    
    if (!formData.get('city')) {
        showBrandedModal({ title: 'Almost there!', message: 'Please select your city to continue.' });
        return;
    }
    const citySelect = document.getElementById('city');
    if (!citySelect || !citySelect.value) {
        showBrandedModal({ title: 'Almost there!', message: 'Please select your city before placing the order.' });
        return;
    }
    const selectedOption = citySelect.options[citySelect.selectedIndex];
    
    // Base shipping fee
    let shippingFee = 0;
    if (cartSubtotal < 2000) {
        shippingFee = parseFloat(selectedOption.dataset.fee) || 50.00;
    }

    // --- NEW: Calculate final numbers including the applied discount ---
    let finalDiscountAmount = 0;
    let finalShippingFee = shippingFee;
    let usedDiscountCode = null;

    if (appliedDiscount) {
        usedDiscountCode = appliedDiscount.code || 'AUTO_DISCOUNT';
        if (appliedDiscount.isFreeShipping || appliedDiscount.type === 'free_shipping') {
            finalShippingFee = 0;
        } else {
            finalDiscountAmount = appliedDiscount.discountAmount || 0;
        }
    }

    const finalTotalAmount = Math.max(0, cartSubtotal + finalShippingFee - finalDiscountAmount);

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
        totalAmount: finalTotalAmount,           // Fixed: Uses post-discount total
        subtotal: cartSubtotal,                  // Fixed: Uses raw cart total
        shippingFee: finalShippingFee,           // Fixed: Free shipping respected
        discountAmount: finalDiscountAmount,     // Added: Saves discount amount
        discountCode: usedDiscountCode,          // Added: Saves code used
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
            window.SirajTracking?.trackPurchase({ ...orderData, orderId: result.orderId });
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

            // Show WhatsApp confirmation screen instead of alert
            await showOrderSuccessWithWhatsApp(result.orderId, orderData);
            window.location.href = 'index.html'; 
        } else {
            throw new Error(result.message || 'Failed to place order.');
        }

    } catch (error) {
        console.error('Order failed: ' + error.message);
        showBrandedModal({ title: 'Order Failed', message: error.message || 'Something went wrong. Please try again.', type: 'error' });
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// ── WhatsApp order confirmation ───────────────────────────────────────────────
async function showOrderSuccessWithWhatsApp(orderId, orderData) {
    return new Promise(async (resolve) => {
        try {
            // Fetch WhatsApp template from site settings
            const res      = await fetch(`${API_BASE_URL}/api/site-settings`);
            const settings = res.ok ? await res.json() : {};

            const template    = settings.whatsappOrderTemplate || '';
            const waPhone     = (settings.whatsappPhone || '+201001775793').replace(/\D/g, '');
            const shortId     = '#' + orderId.toString().slice(-8).toUpperCase();

            // Build items list
            const itemLines = (orderData.items || []).map(i =>
                `• ${i.name}${i.variantName ? ` (${i.variantName})` : ''} × ${i.quantity}`
            ).join('\n');

            // Replace placeholders
            const message = template
                .replace(/\{\{name\}\}/g,    orderData.customerInfo?.name || 'عزيزتي')
                .replace(/\{\{orderId\}\}/g, shortId)
                .replace(/\{\{total\}\}/g,   orderData.totalAmount?.toFixed(2) || '0')
                .replace(/\{\{items\}\}/g,   itemLines)
                .replace(/\{\{city\}\}/g,    orderData.customerInfo?.city || '');

            const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;

            // Build overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position:fixed; inset:0; background:rgba(30,16,35,0.85);
                display:flex; align-items:center; justify-content:center;
                z-index:99999; padding:16px; backdrop-filter:blur(6px);
            `;

            overlay.innerHTML = `
                <div style="
                    background:#fff; border-radius:20px; padding:32px 28px;
                    max-width:480px; width:100%; text-align:center;
                    box-shadow:0 24px 60px rgba(0,0,0,0.3);
                    font-family: 'Montserrat', sans-serif;
                ">
                    <div style="font-size:48px; margin-bottom:12px;">🎉</div>
                    <h2 style="color:#1E1023; font-size:22px; font-weight:800; margin:0 0 6px;">
                        تم استلام طلبك!
                    </h2>
                    <p style="color:#6B4A6E; font-size:14px; margin:0 0 6px;">
                        Order ID: <strong style="color:#BE185D;">${shortId}</strong>
                    </p>
                    <p style="color:#6B4A6E; font-size:13px; margin:0 0 20px;">
                        Total: <strong>${orderData.totalAmount?.toFixed(2)} EGP</strong>
                    </p>

                    <div style="
                        background:#f0fdf4; border:1px solid #bbf7d0;
                        border-radius:12px; padding:14px 16px; margin-bottom:20px;
                        text-align:right; direction:rtl;
                    ">
                        <p style="color:#065f46; font-size:12px; font-weight:700; margin:0 0 8px;">
                            📱 رسالة التأكيد جاهزة على واتساب:
                        </p>
                        <p style="color:#374151; font-size:11px; margin:0; white-space:pre-wrap; line-height:1.6; text-align:right;">
                            ${message.slice(0, 200)}${message.length > 200 ? '...' : ''}
                        </p>
                    </div>

                    <a href="${waUrl}" target="_blank" onclick="setTimeout(() => { document.getElementById('siraj-order-overlay').remove(); }, 500);" style="
                        display:block; padding:14px; margin-bottom:12px;
                        background:linear-gradient(135deg, #25D366, #128C7E);
                        color:#fff; border-radius:12px; text-decoration:none;
                        font-weight:800; font-size:15px;
                        box-shadow:0 4px 14px rgba(37,211,102,0.35);
                    ">
                        📱 إرسال تأكيد الطلب على واتساب
                    </a>

                    <button onclick="document.getElementById('siraj-order-overlay').remove();" style="
                        display:block; width:100%; padding:11px;
                        background:#FCE7F3; color:#BE185D; border:none;
                        border-radius:12px; font-weight:700; font-size:14px;
                        cursor:pointer; font-family:inherit;
                    ">
                        متابعة التسوق
                    </button>
                </div>
            `;

            overlay.id = 'siraj-order-overlay';
            document.body.appendChild(overlay);

            // Auto-resolve after 60 seconds so page doesn't stay stuck
            const autoResolve = setTimeout(resolve, 60000);

            // Resolve when overlay is removed (button clicked or WhatsApp opened)
            const observer = new MutationObserver(() => {
                if (!document.getElementById('siraj-order-overlay')) {
                    clearTimeout(autoResolve);
                    observer.disconnect();
                    setTimeout(resolve, 500);
                }
            });
            observer.observe(document.body, { childList: true });

        } catch (e) {
            console.error('WhatsApp screen error:', e);
            resolve(); // never block the flow
        }
    });
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
    const banner = document.createElement('div');
    banner.className = 'auto-discount-banner';
    banner.textContent = `🎉 ${best.message}`;
    discountSection.insertBefore(banner, discountSection.firstChild);
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
    const phone = document.getElementById('review-phone')?.value.trim();
    const comment = document.getElementById('review-comment')?.value.trim();
    const rating = +document.getElementById('review-rating')?.value;
    const msgEl = document.getElementById('review-form-msg');

    const showMsg = (text, ok) => {
        if (!msgEl) return;
        msgEl.style.display = 'block';
        msgEl.textContent = text;
        msgEl.className = 'review-form-msg ' + (ok ? 'msg-success' : 'msg-error');
    };

if (!email) return showMsg('Please enter your email.', false);
if (!phone) return showMsg('Please enter your phone number.', false);
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
            body: JSON.stringify({ name, email, phone , rating, comment, photos: uploadedPhotos })
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


// ── Load site-wide settings (ribbon, nav, footer) ─────────────────────────
async function loadSiteSettings() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/site-settings`);
        if (!res.ok) return;
        const settings = await res.json();

        updateRibbon(settings);
        updateNav(settings);
        updateFooter(settings);
        buildMobileMenu();

        siteFreeGiftSettings = settings.freeGift || null;
        updateFreeGiftBar();
    } catch (e) {
        console.error('Failed to load site settings:', e);
    }
}

// ── Ribbon: rotating messages ─────────────────────────────────────────────
function updateRibbon(settings) {
    const ribbon = document.getElementById('announcement-ribbon');
    if (!ribbon) return;

    if (!settings.ribbonEnabled) {
        ribbon.style.display = 'none';
        return;
    }

    ribbon.style.display = '';

    const msgs = settings.ribbonMessages || [];
    if (msgs.length === 0) return; // keep default HTML content

    // Build rotating spans
    ribbon.innerHTML = `<p>${msgs.map((m, i) =>
        `<span class="ribbon-msg${i === 0 ? ' active' : ''}">${escapeHtml(m)}</span>`
    ).join('')}</p>`;

    if (msgs.length <= 1) return; // no rotation needed

    let current = 0;
    const speed = settings.ribbonSpeed || 4000;

    setInterval(() => {
        const all = ribbon.querySelectorAll('.ribbon-msg');
        all[current].classList.remove('active');
        current = (current + 1) % msgs.length;
        all[current].classList.add('active');
    }, speed);
}

// ── Nav: show/hide links based on settings ────────────────────────────────
function updateNav(settings) {
    if (!settings.navLinks) return;

    const navMap = {
        home:       'index.html',
        products:   'products.html',
        bundles:    'bundles.html',
        trackOrder: 'order-tracking.html',
        stores:     'Stores.html',
    };

    // Desktop nav
    const navLinks = document.querySelectorAll('.nav-links li a');
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        const key = Object.keys(navMap).find(k => href && href.includes(navMap[k]));
        if (!key) return;
        const visible = settings.navLinks[key] !== false;
        link.parentElement.style.display = visible ? '' : 'none';
    });

    // Add stores link to desktop nav if enabled and not already there
    if (settings.navLinks.stores) {
        const navList = document.querySelector('.nav-links');
        if (navList && !navList.querySelector('a[href="Stores.html"]')) {
            const li = document.createElement('li');
            li.innerHTML = `<a href="Stores.html"><i class="fas fa-map-marker-alt"></i> Our Stores</a>`;
            // Mark active if on stores page
            if (window.location.pathname.includes('Stores.html')) {
                li.querySelector('a').classList.add('active');
            }
            navList.appendChild(li);
        }
    }
}

// ── Footer: update from settings ─────────────────────────────────────────
function updateFooter(settings) {
    const footer = document.querySelector('.footer');
    if (!footer) return;

    // Build footer HTML from settings
    const hasStores = settings.navLinks?.stores;

    footer.innerHTML = `
        <p>Email us for <strong>bulk orders</strong> and <strong>customized gifts</strong>:
            <a href="mailto:${escapeHtml(settings.footerEmail || 'orders@sirajcandles.com')}" class="email-btn">
                ${escapeHtml(settings.footerEmail || 'orders@sirajcandles.com')}
            </a>
        </p>
        <p style="margin-top: 15px;">
            <a href="order-tracking.html" style="font-weight: 600; text-decoration: underline;">Track Your Order Here</a>
        </p>
        ${hasStores ? `
        <p style="margin-top: 8px;">
            <a href="Stores.html" class="footer-stores-link">
                <i class="fas fa-map-marker-alt"></i> Visit Our Stores
            </a>
        </p>` : ''}
        <p>${escapeHtml(settings.footerCopyright || '© 2025 Siraj Candles. All rights reserved.')}</p>
        <div class="social-links">
            ${settings.footerInstagram ? `<a href="${settings.footerInstagram}" target="_blank" aria-label="Instagram"><i class="fab fa-instagram"></i></a>` : ''}
            ${settings.footerFacebook  ? `<a href="${settings.footerFacebook}"  target="_blank" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>` : ''}
            ${settings.footerTiktok    ? `<a href="${settings.footerTiktok}"    target="_blank" aria-label="TikTok"><i class="fab fa-tiktok"></i></a>` : ''}
        </div>
        <p>${escapeHtml(settings.footerTagline || 'From our Home to Yours ❤️')}</p>
    `;
}

// ── Stores Page ───────────────────────────────────────────────────────────
async function setupStoresPage() {
    const container = document.getElementById('stores-container');
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/stores`);
        if (!res.ok) throw new Error('Failed to load stores');
        const stores = await res.json();

        if (stores.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding: 4rem 1rem; color: var(--text-muted);">
                    <i class="fas fa-map-marker-alt" style="font-size:3rem; color:var(--brand); margin-bottom:1rem; display:block;"></i>
                    <p style="font-size:1.1rem;">Store locations coming soon!</p>
                    <p style="margin-top:0.5rem; font-size:0.9rem;">Check back here for updates on where to find us in person.</p>
                </div>`;
            return;
        }

        container.innerHTML = stores.map(store => `
            <div class="store-card">
                ${store.mapsEmbedUrl
                    ? `<iframe class="store-map" src="${store.mapsEmbedUrl}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
                    : `<div class="store-map-placeholder">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>Map coming soon</span>
                       </div>`
                }
                <div class="store-info">
                    <h2 class="store-name">${escapeHtml(store.name)}</h2>
                    ${store.address ? `
                    <div class="store-detail">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${escapeHtml(store.address)}</span>
                    </div>` : ''}
                    ${store.phone ? `
                    <div class="store-detail">
                        <i class="fas fa-phone"></i>
                        <span><a href="tel:${escapeHtml(store.phone)}" style="color:inherit;">${escapeHtml(store.phone)}</a></span>
                    </div>` : ''}
                    ${store.hours ? `
                    <div class="store-detail">
                        <i class="fas fa-clock"></i>
                        <span>${escapeHtml(store.hours)}</span>
                    </div>` : ''}
                </div>
                ${store.photos && store.photos.length > 0 ? `
                <div class="store-photos">
                    ${store.photos.map(p => `<img src="${p}" alt="${escapeHtml(store.name)}" class="store-photo" loading="lazy">`).join('')}
                </div>` : ''}
            </div>
        `).join('');

    } catch (e) {
        container.innerHTML = `<p class="error-message" style="text-align:center;">Could not load store locations. Please try again later.</p>`;
        console.error(e);
    }
}