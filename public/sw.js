self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : { title: 'ADHAVAN.AI', body: 'You have a new update.' };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'ADHAVAN.AI', {
      body: payload.body || 'You have a new update.',
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url: payload.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url === url);
    return existing ? existing.focus() : clients.openWindow(url);
  }));
});
