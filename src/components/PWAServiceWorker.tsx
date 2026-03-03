'use client';
import { useEffect } from 'react';

export default function PWAServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Register the service worker
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Service Worker registered
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });

      // Request notification permission for Phase 4
      if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
             // Notification permission granted.
          }
        });
      }
    }
  }, []);

  return null;
}
