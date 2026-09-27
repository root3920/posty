'use client';

import * as React from 'react';

// -------------------------------------------------------
// Context
// -------------------------------------------------------

interface GeoContextValue {
  defaultCountry: string;
}

const GeoContext = React.createContext<GeoContextValue>({ defaultCountry: 'CO' });

// -------------------------------------------------------
// Provider
// -------------------------------------------------------

interface GeoProviderProps {
  initialCountry?: string;
  children: React.ReactNode;
}

export function GeoProvider({ initialCountry = 'CO', children }: GeoProviderProps) {
  const value = React.useMemo<GeoContextValue>(
    () => ({ defaultCountry: initialCountry }),
    [initialCountry],
  );

  return <GeoContext.Provider value={value}>{children}</GeoContext.Provider>;
}

// -------------------------------------------------------
// Hook
// -------------------------------------------------------

export function useDefaultCountry(): string {
  return React.useContext(GeoContext).defaultCountry;
}
