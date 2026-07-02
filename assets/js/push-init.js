// Siraj Candles — PWA Push Notification Registration
// Include this in admin-upload.html only (not customer pages)
// It registers your phone to receive order push notifications

const VAPID_PUBLIC_KEY = 'BP1QRX_f1B8SUbaKHscR8_gsFOD2sTiXlbiaUhJRwIp2SiJf7RUAJxQmeYhWRA5BPE73is-foedjOxFA6lzaHoI';
const API_BASE         = 'https://siraj-backend.onrender.com';

function urlBase64ToUint8Array(base64String) {
  const padding  = '='.repeat((4 - base64String.length % 4) % 4);
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData  = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function registerPushNotifications() {
  // Only run if browser supports service workers and push
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications not supported in this browser.');
    return;
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    console.log('✅ Service worker registered');

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Ask user for permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Push permission denied.');
        return;
      }

      // Subscribe
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Send subscription to backend
    const token = localStorage.getItem('adminToken');
    if (!token) return; // not logged in yet, will retry on next visit

    const res = await fetch(`${API_BASE}/api/push/subscribe`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ subscription }),
    });

    if (res.ok) {
      console.log('✅ Push subscription sent to server — you will now receive order notifications!');
    }
  } catch (err) {
    console.error('Push registration error:', err);
  }
}

// Run after page loads and user is logged in
window.addEventListener('load', () => {
  // Small delay to let admin login complete
  setTimeout(registerPushNotifications, 3000);
});