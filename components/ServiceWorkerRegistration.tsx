'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => {
                    console.log("Satpam Service Worker berhasil direkrut!", registration.scope);
                })
                .catch((err) => {
                    console.warn("Service Worker registration skipped:", err.message);
                });
        }
    }, []);

    return null;
}
