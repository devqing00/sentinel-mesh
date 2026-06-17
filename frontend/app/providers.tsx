"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { SWRConfig } from 'swr';

function localStorageProvider() {
  if (typeof window === 'undefined') return new Map();
  try {
    const map = new Map(JSON.parse(localStorage.getItem('sentinel-swr-cache') || '[]'));
    window.addEventListener('beforeunload', () => {
      const appCache = JSON.stringify(Array.from(map.entries()));
      localStorage.setItem('sentinel-swr-cache', appCache);
    });
    return map;
  } catch (e) {
    return new Map();
  }
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SWRConfig value={{ provider: localStorageProvider }}>
        {children}
      </SWRConfig>
    </QueryClientProvider>
  );
}
