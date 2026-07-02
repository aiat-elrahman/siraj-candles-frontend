const TRACKING_CONFIG = {
  metaPixelId: 'REPLACE_WITH_META_PIXEL_ID',
  googleMeasurementId: 'REPLACE_WITH_GA4_MEASUREMENT_ID',
};

const TRACKING_API_BASE_URL = 'https://siraj-backend.onrender.com';
const hasRealId = (value, placeholder) => value && value !== placeholder && !value.includes('REPLACE_WITH');
const getSessionId = () => {
  const key = 'sirajTrackingSessionId';
  let sessionId = localStorage.getItem(key);
  if (!sessionId) {
    sessionId = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, sessionId);
  }
  return sessionId;
};

const getUtm = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get('utm_source') || '',
    utmMedium: params.get('utm_medium') || '',
    utmCampaign: params.get('utm_campaign') || '',
  };
};

const postTrackingEvent = (type, payload = {}) => {
  const body = JSON.stringify({
    type,
    sessionId: getSessionId(),
    path: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer || '',
    ...getUtm(),
    ...payload,
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(`${TRACKING_API_BASE_URL}/api/tracking/event`, blob);
    return;
  }

  fetch(`${TRACKING_API_BASE_URL}/api/tracking/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
};

window.SirajTracking = {
  metaPixelId: TRACKING_CONFIG.metaPixelId,
  googleMeasurementId: TRACKING_CONFIG.googleMeasurementId,

  trackMeta(eventName, payload = {}) {
    if (typeof window.fbq === 'function') {
      window.fbq('track', eventName, payload);
    }
  },

  trackGoogle(eventName, payload = {}) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, payload);
    }
  },

  trackLocal(type, payload = {}) {
    postTrackingEvent(type, payload);
  },

  trackViewContent(product) {
    const value = Number(product.price_egp || product.bundlePrice || product.price || 0);

    this.trackMeta('ViewContent', {
      content_name: product.name_en || product.bundleName || product.name,
      content_ids: [product._id].filter(Boolean),
      content_type: 'product',
      value,
      currency: 'EGP',
    });

    this.trackGoogle('view_item', {
      currency: 'EGP',
      value,
      items: [{
        item_id: product._id,
        item_name: product.name_en || product.bundleName || product.name,
        item_category: product.category || '',
        price: value,
      }],
    });

    this.trackLocal('view_content', {
      value,
      metadata: {
        productId: product._id,
        productName: product.name_en || product.bundleName || product.name,
        category: product.category || '',
      },
    });
  },

  trackAddToCart(product) {
    const value = Number(product.price || product.price_egp || product.bundlePrice || 0);

    this.trackMeta('AddToCart', {
      content_name: product.name,
      content_ids: [product._id].filter(Boolean),
      content_type: 'product',
      value,
      currency: 'EGP',
    });

    this.trackGoogle('add_to_cart', {
      currency: 'EGP',
      value,
      items: [{
        item_id: product._id,
        item_name: product.name,
        item_variant: product.variantName || '',
        quantity: Number(product.quantity || 1),
        price: value,
      }],
    });

    this.trackLocal('add_to_cart', {
      value,
      metadata: {
        productId: product._id,
        productName: product.name,
        variantName: product.variantName || '',
        quantity: Number(product.quantity || 1),
      },
    });
  },

  trackBeginCheckout(cartItems = [], totalAmount = 0) {
    const items = cartItems.map(item => ({
      item_id: item._id,
      item_name: item.name,
      item_variant: item.variantName || '',
      quantity: Number(item.quantity || 1),
      price: Number(item.price || 0),
    }));

    this.trackMeta('InitiateCheckout', {
      value: Number(totalAmount || 0),
      currency: 'EGP',
      content_ids: cartItems.map(item => item._id).filter(Boolean),
      contents: cartItems.map(item => ({
        id: item._id,
        quantity: Number(item.quantity || 1),
        item_price: Number(item.price || 0),
      })),
      num_items: cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    });

    this.trackGoogle('begin_checkout', {
      currency: 'EGP',
      value: Number(totalAmount || 0),
      items,
    });

    this.trackLocal('begin_checkout', {
      value: Number(totalAmount || 0),
      metadata: { itemCount: cartItems.length },
    });
  },

  trackPurchase(order) {
    const items = order.items || [];
    const payload = {
      value: Number(order.totalAmount || 0),
      currency: 'EGP',
      content_ids: items.map(item => item.productId).filter(Boolean),
      content_type: 'product',
      contents: items.map(item => ({
        id: item.productId,
        quantity: Number(item.quantity || 1),
        item_price: Number(item.price || 0),
      })),
      num_items: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    };

    this.trackMeta('Purchase', payload);
    this.trackGoogle('purchase', {
      transaction_id: order.orderId || '',
      value: payload.value,
      currency: 'EGP',
      shipping: Number(order.shippingFee || 0),
      coupon: order.discountCode || '',
      items: items.map(item => ({
        item_id: item.productId,
        item_name: item.name,
        quantity: Number(item.quantity || 1),
        price: Number(item.price || 0),
      })),
    });

    this.trackLocal('purchase', {
      value: payload.value,
      currency: 'EGP',
      orderId: order.orderId || '',
      metadata: {
        discountCode: order.discountCode || '',
        itemCount: payload.num_items,
        contentIds: payload.content_ids,
      },
    });
  },
};

if (hasRealId(TRACKING_CONFIG.googleMeasurementId, 'REPLACE_WITH_GA4_MEASUREMENT_ID')) {
  const gtagScript = document.createElement('script');
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${TRACKING_CONFIG.googleMeasurementId}`;
  document.head.appendChild(gtagScript);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', TRACKING_CONFIG.googleMeasurementId);
}

if (hasRealId(TRACKING_CONFIG.metaPixelId, 'REPLACE_WITH_META_PIXEL_ID')) {
  !function(f,b,e,v,n,t,s) {
    if (f.fbq) return;
    n = f.fbq = function(){ n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  window.fbq('init', TRACKING_CONFIG.metaPixelId);
  window.fbq('track', 'PageView');
}

postTrackingEvent('page_view');
