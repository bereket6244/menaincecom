/* Service worker: receives admin push notifications for new orders. */
/* URLs resolve against the registration scope so the app also works when
   deployed under a base path. */
self.addEventListener('push', (event) => {
  let data = { title: 'mena inc', body: 'New activity', url: 'admin' };
  try { data = { ...data, ...event.data.json() }; } catch { /* keep defaults */ }
  const icon = new URL('menainc-icon.png', self.registration.scope).href;
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
      badge: icon,
      icon,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data?.url || 'admin').replace(/^\//, ''), self.registration.scope).href;
  event.waitUntil(clients.openWindow(url));
});
