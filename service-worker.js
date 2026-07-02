// Siraj Candles — Service Worker
// Handles PWA push notifications for order alerts

const CACHE_NAME = 'siraj-v1';

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// ── Push notification received ────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Siraj Candles', body: event.data ? event.data.text() : 'New notification' };
  }

  const title   = data.title   || '🛍️ Siraj Candles';
  const options = {
    body:    data.body    || 'You have a new notification',
    icon:    data.icon    || '/assets/images/icon-192.png',
    badge:   data.badge   || '/assets/images/icon-192.png',
    tag:     data.tag     || 'siraj-order',
    data:    data.url     ? { url: data.url } : {},
    vibrate: [200, 100, 200],
    requireInteraction: true, // stays on screen until dismissed
    actions: [
      { action: 'view',    title: '👀 View Orders' },
      { action: 'dismiss', title: '✕ Dismiss'      },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  // Open admin dashboard on click
  const urlToOpen = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : 'https://sirajcare.com/admin-upload';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If admin is already open, focus it
      for (const client of clientList) {
        if (client.url.includes('admin-upload') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open it
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});