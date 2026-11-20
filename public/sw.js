self.addEventListener('install', () => {
    self.skipWaiting(); // Force update immediately
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim()); // Take control of all open tabs/clients immediately
});

self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push Received.');

    // Default nilai kalau suratnya kosong
    let title = 'ManaoHQ System';
    let body = 'Ada pembaruan baru!';
    let icon = '/logo-manao.svg';
    let tag = 'manao-update';
    let url = '/';

    if (event.data) {
        try {
            // Coba baca sebagai JSON dulu
            const data = event.data.json();
            title = data.title || title;
            body = data.body || body;
            icon = data.icon || icon;
            tag = data.tag || Math.random().toString(36).substring(7); // Grouping tag
            url = data.url || url;
        } catch (e) {
            // Kalau gagal baca JSON (karena dites via DevTools / teks biasa), pake teksnya langsung!
            console.log('Push data bukan JSON, pake format teks biasa.');
            body = event.data.text();
            tag = 'manao-text-update';
        }
    }

    event.waitUntil(
        self.registration.showNotification(title, {
            body: body,
            icon: icon,
            tag: tag, // Natively deduplicates and replaces identical bubbles
            renotify: false, // Prevents multiple sounds for same tag
            data: { url: url }
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    let urlToOpen = event.notification.data?.url || '/';

    // Validate the URL strictly
    try {
        const parsedUrl = new URL(urlToOpen, self.location.origin);
        // Only allow http and https schemes to prevent arbitrary protocol execution (e.g. javascript:, file:)
        if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
            urlToOpen = parsedUrl.href;
        } else {
            console.error('Service Worker: Blocked unsafe notification URL scheme:', parsedUrl.protocol);
            urlToOpen = '/';
        }
    } catch {
        urlToOpen = '/';
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // If an existing tab is open, send a message instead of navigate() to avoid full reload
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if ('focus' in client) {
                    // Send the URL via postMessage so the app can handle it client-side
                    client.postMessage({ type: 'NOTIFICATION_CLICK', url: urlToOpen });
                    return client.focus();
                }
            }
            // No open tab found — open a new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});