/* Service worker: receives admin push notifications for new orders. */
self.addEventListener('push', (event) => {
  let data = { title: 'MENA INC.', body: 'New activity', url: '/admin' };
  try { data = { ...data, ...event.data.json() }; } catch { /* keep defaults */ }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
      badge: '/favicon.svg',
      icon: '/favicon.svg',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/admin';
  event.waitUntil(clients.openWindow(url));
});
