const TRACKING_CONFIG = {
  metaPixelId: 'REPLACE_WITH_META_PIXEL_ID',
  googleMeasurementId: 'REPLACE_WITH_GA4_MEASUREMENT_ID',
};

const hasRealId = (value, placeholder) => value && value !== placeholder && !value.includes('REPLACE_WITH');

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
