/* Siraj Candles — campaign landing page renderer.
   One template, many pages: /landing.html?slug=<slug> (or /landing.html?p=<slug>).
   All copy, imagery and products come from the admin (Landing Pages manager).
   Relies on site.js for the header, cart UI and window.addToCart. */
(function () {
    'use strict';

    var API = 'https://siraj-backend.onrender.com';
    var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];

    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function money(n) { return Number(n || 0).toFixed(2) + ' EGP'; }
    function safeIcon(c) { return /^fa-[a-z0-9-]+$/i.test(c || '') ? c : 'fa-heart'; }

    // ---- UTM preservation (so the ad click survives to checkout/attribution) ----
    function captureUtms() {
        try {
            var q = new URLSearchParams(location.search), saved = {};
            try { saved = JSON.parse(sessionStorage.getItem('sirajUtm') || '{}'); } catch (e) {}
            UTM_KEYS.forEach(function (k) { if (q.get(k)) saved[k] = q.get(k); });
            sessionStorage.setItem('sirajUtm', JSON.stringify(saved));
            return saved;
        } catch (e) { return {}; }
    }
    function withUtms(url, utms) {
        var qs = Object.keys(utms).map(function (k) { return k + '=' + encodeURIComponent(utms[k]); }).join('&');
        if (!qs) return url;
        return url + (url.indexOf('?') > -1 ? '&' : '?') + qs;
    }

    function getParam(name) { return new URLSearchParams(location.search).get(name); }

    function isBundle(p) { return p.productType === 'Bundle' || (p.bundleItems && p.bundleItems.length > 0); }
    function nameOf(p) { return isBundle(p) ? (p.bundleName || p.name_en) : p.name_en; }
    function stockOf(p) {
        var s = p.stockOnline !== undefined ? p.stockOnline : p.stock;
        return Number(s) || 0;
    }

    // ---- fetching ----
    function fetchJson(url) {
        return fetch(url).then(function (r) {
            if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
            return r.json();
        });
    }
    // Per-id fetch (not ?ids=) so bundles get their real, computed stock.
    function fetchProducts(ids) {
        return Promise.all(ids.map(function (id) {
            return fetchJson(API + '/api/products/' + encodeURIComponent(id)).catch(function () { return null; });
        })).then(function (list) {
            return list.filter(function (p) {
                return p && p.status !== 'Draft' && p.status !== 'Archived' && !p.hideFromShop;
            });
        });
    }

    // ---- rendering ----
    function renderProductCard(p, utms) {
        var bundle = isBundle(p);
        var name = nameOf(p);
        var img = (p.imagePaths && p.imagePaths[0]) || '';
        var link = withUtms('product.html?slug=' + encodeURIComponent(p.slug || p._id), utms);
        var hasVariants = !bundle && p.variants && p.variants.length > 0;
        var stock = stockOf(p);
        var priceHtml, controls;

        if (hasVariants) {
            var vs = p.variants.map(function (v) {
                var s = Number(v.stockOnline !== undefined ? v.stockOnline : v.stock) || 0;
                return { name: v.variantName, price: Number(v.price) || Number(p.price_egp) || 0, stock: s };
            });
            var avail = vs.filter(function (v) { return v.stock > 0; });
            if (!avail.length) {
                priceHtml = '<span class="lp-price">' + money(vs[0] ? vs[0].price : 0) + '</span>';
                controls = '<button class="lp-btn lp-btn-disabled" disabled>Sold Out</button>';
            } else {
                var min = Math.min.apply(null, avail.map(function (v) { return v.price; }));
                priceHtml = '<span class="lp-price">' + (avail.length > 1 ? 'From ' : '') + money(min) + '</span>';
                controls =
                    '<select class="lp-variant" aria-label="Choose option">' +
                    avail.map(function (v) {
                        return '<option value="' + esc(v.name) + '" data-price="' + v.price + '" data-stock="' + v.stock + '">' +
                            esc(v.name) + ' — ' + money(v.price) + '</option>';
                    }).join('') + '</select>' +
                    '<button class="lp-btn lp-add" data-mode="variant">Add to Cart</button>';
            }
        } else if (bundle) {
            var bp = Number(p.bundlePrice || p.price_egp || 0);
            priceHtml = '<span class="lp-price">' + money(bp) + '</span>';
            controls = stock > 0
                ? '<a class="lp-btn lp-choose" href="' + esc(link) + '">Choose Your Scents</a>'
                : '<button class="lp-btn lp-btn-disabled" disabled>Sold Out</button>';
        } else {
            var base = Number(p.price_egp || 0);
            var onSale = p.salePrice && p.salePrice < base;
            priceHtml = onSale
                ? '<span class="lp-price-old">' + money(base) + '</span> <span class="lp-price lp-price-sale">' + money(p.salePrice) + '</span>'
                : '<span class="lp-price">' + money(base) + '</span>';
            controls = stock > 0
                ? '<button class="lp-btn lp-add" data-mode="simple">Add to Cart</button>'
                : '<button class="lp-btn lp-btn-disabled" disabled>Sold Out</button>';
        }

        return '<article class="lp-card" data-id="' + esc(p._id) + '">' +
            '<a class="lp-card-img" href="' + esc(link) + '">' +
            (img ? '<img src="' + esc(img) + '" alt="' + esc(name) + '" loading="lazy">' : '') +
            '</a>' +
            '<div class="lp-card-body">' +
            '<h3 class="lp-card-title"><a href="' + esc(link) + '">' + esc(name) + '</a></h3>' +
            '<div class="lp-card-price">' + priceHtml + '</div>' +
            '<div class="lp-card-actions">' + controls + '</div>' +
            '</div></article>';
    }

    function stars(n) {
        var r = Math.max(1, Math.min(5, Number(n) || 5)), out = '';
        for (var i = 0; i < 5; i++) out += '<i class="' + (i < r ? 'fas' : 'far') + ' fa-star"></i>';
        return '<span class="lp-stars" aria-label="' + r + ' out of 5">' + out + '</span>';
    }

    function renderPage(page, products, utms) {
        var h = '';

        h += '<section class="lp-hero"' +
            (page.heroImage ? ' style="background-image:linear-gradient(rgba(30,16,35,.55),rgba(30,16,35,.65)),url(\'' + esc(page.heroImage) + '\')"' : '') + '>' +
            '<div class="lp-hero-inner">' +
            (page.eyebrow ? '<p class="lp-eyebrow">' + esc(page.eyebrow) + '</p>' : '') +
            '<h1 class="lp-headline">' + esc(page.headline || page.metaTitle || '') + '</h1>' +
            (page.subheadline ? '<p class="lp-sub">' + esc(page.subheadline) + '</p>' : '') +
            (page.offerBadge ? '<p class="lp-offer"><i class="fas fa-tag"></i> ' + esc(page.offerBadge) + '</p>' : '') +
            '<a href="#lp-products" class="lp-cta" id="lp-hero-cta">' + esc(page.ctaText || 'Shop Now') + '</a>' +
            '</div></section>';

        if (page.benefits && page.benefits.length) {
            h += '<section class="lp-benefits"><div class="lp-wrap">' +
                page.benefits.map(function (b) {
                    return '<div class="lp-benefit"><i class="fas ' + safeIcon(b.icon) + '"></i>' +
                        '<h3>' + esc(b.title) + '</h3><p>' + esc(b.text) + '</p></div>';
                }).join('') + '</div></section>';
        }

        h += '<section class="lp-products" id="lp-products"><div class="lp-wrap">' +
            (page.productsHeading ? '<h2 class="lp-h2">' + esc(page.productsHeading) + '</h2>' : '') +
            (products.length
                ? '<div class="lp-grid">' + products.map(function (p) { return renderProductCard(p, utms); }).join('') + '</div>'
                : '<p class="lp-empty">These items are not available right now. Please check back soon.</p>') +
            '</div></section>';

        if (page.howItWorksEnabled && page.howItWorksSteps && page.howItWorksSteps.length) {
            h += '<section class="lp-how"><div class="lp-wrap">' +
                '<h2 class="lp-h2">' + esc(page.howItWorksHeading || 'How ordering works') + '</h2>' +
                '<ol class="lp-steps">' +
                page.howItWorksSteps.map(function (s, i) {
                    return '<li><span class="lp-step-num">' + (i + 1) + '</span><div><h3>' + esc(s.title) +
                        '</h3><p>' + esc(s.text) + '</p></div></li>';
                }).join('') + '</ol></div></section>';
        }

        if (page.reviews && page.reviews.length) {
            h += '<section class="lp-reviews"><div class="lp-wrap"><h2 class="lp-h2">What customers say</h2><div class="lp-review-grid">' +
                page.reviews.map(function (r) {
                    return '<blockquote class="lp-review">' + stars(r.rating) +
                        '<p>“' + esc(r.text) + '”</p><footer>— ' + esc(r.name) + '</footer></blockquote>';
                }).join('') + '</div></div></section>';
        }

        if (page.faq && page.faq.length) {
            h += '<section class="lp-faq"><div class="lp-wrap lp-wrap-narrow"><h2 class="lp-h2">Questions</h2>' +
                page.faq.map(function (f) {
                    return '<details class="lp-faq-item"><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>';
                }).join('') + '</div></section>';
        }

        document.getElementById('landing-root').innerHTML = h;
    }

    // ---- cart actions ----
    function bindCart(products) {
        var byId = {};
        products.forEach(function (p) { byId[p._id] = p; });

        document.getElementById('landing-root').addEventListener('click', function (e) {
            var btn = e.target.closest('.lp-add');
            if (!btn) return;
            var card = btn.closest('.lp-card');
            var p = card && byId[card.getAttribute('data-id')];
            if (!p || typeof window.addToCart !== 'function') return;

            var item, stock;
            if (btn.getAttribute('data-mode') === 'variant') {
                var sel = card.querySelector('.lp-variant');
                var opt = sel.options[sel.selectedIndex];
                stock = parseInt(opt.getAttribute('data-stock'), 10) || 0;
                if (stock <= 0) return;
                item = {
                    _id: p._id, name: p.name_en, category: p.category || '', subcategory: p.subcategory || '',
                    price: parseFloat(opt.getAttribute('data-price')), quantity: 1,
                    imageUrl: p.imagePaths && p.imagePaths[0], variantName: sel.value,
                    maxStock: stock, customization: [], slug: p.slug || p._id
                };
            } else {
                stock = stockOf(p);
                if (stock <= 0) return;
                var base = Number(p.price_egp || 0);
                item = {
                    _id: p._id, name: p.name_en, category: p.category || '', subcategory: p.subcategory || '',
                    price: (p.salePrice && p.salePrice < base) ? p.salePrice : base, quantity: 1,
                    imageUrl: p.imagePaths && p.imagePaths[0], variantName: null,
                    maxStock: stock, customization: [], slug: p.slug || p._id
                };
            }
            window.addToCart(item);
            syncSticky();
        });
    }

    function cartCount() {
        try {
            var c = JSON.parse(localStorage.getItem('sirajCart') || '[]');
            return c.reduce(function (n, i) { return n + (Number(i.quantity) || 0); }, 0);
        } catch (e) { return 0; }
    }
    function syncSticky() {
        var n = cartCount();
        var bar = document.getElementById('lp-sticky');
        if (!bar) return;
        document.getElementById('lp-sticky-count').textContent = n;
        bar.classList.toggle('has-items', n > 0);
    }

    function setupSticky(page) {
        var bar = document.getElementById('lp-sticky');
        document.getElementById('lp-sticky-shop').textContent = page.ctaText || 'Shop Now';
        bar.hidden = false;
        syncSticky();
        window.addEventListener('storage', syncSticky);
        setInterval(syncSticky, 1500); // cart is mutated by site.js; cheap, keeps count honest
    }

    function showNotFound() {
        document.getElementById('landing-root').innerHTML =
            '<section class="lp-notfound"><h1 class="lp-headline">This page isn’t available</h1>' +
            '<p>The offer you’re looking for may have ended.</p>' +
            '<a class="lp-cta" href="products.html">Browse all products</a></section>';
    }

    function track(page, products) {
        try {
            if (window.SirajTracking && typeof window.SirajTracking.trackViewContent === 'function') {
                window.SirajTracking.trackViewContent({
                    _id: 'landing_' + page.slug,
                    name_en: page.contentName || page.headline || page.slug,
                    category: 'Landing Page',
                    price_egp: products.length ? Number(products[0].price_egp || products[0].bundlePrice || 0) : 0
                });
            }
        } catch (e) { /* tracking must never break the page */ }
    }

    function init() {
        var slug = (getParam('slug') || getParam('p') || '').toLowerCase().trim();
        var utms = captureUtms();
        if (!slug) { showNotFound(); return; }

        fetchJson(API + '/api/landing/' + encodeURIComponent(slug))
            .then(function (page) {
                document.title = (page.metaTitle || page.headline || 'Siraj Candles') + ' | Siraj Candles';
                var md = document.querySelector('meta[name="description"]');
                if (md && page.metaDescription) md.setAttribute('content', page.metaDescription);
                return fetchProducts(page.productIds || []).then(function (products) {
                    renderPage(page, products, utms);
                    bindCart(products);
                    setupSticky(page);
                    track(page, products);
                });
            })
            .catch(function (err) {
                if (err && err.status === 404) showNotFound();
                else document.getElementById('landing-root').innerHTML =
                    '<p class="lp-loading">Something went wrong loading this page. Please refresh.</p>';
            });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();