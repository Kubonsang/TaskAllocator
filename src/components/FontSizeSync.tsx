'use client';

import { useEffect } from 'react';

export default function FontSizeSync() {
  useEffect(() => {
    const savedSize = localStorage.getItem('app-font-size') || '16px';
    document.documentElement.style.setProperty('--base-font-size', savedSize);
  }, []);

  return null;
}
