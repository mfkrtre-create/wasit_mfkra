import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Listing } from '@/ui/types';

interface AppContextValue {
  quickAddOpen: boolean;
  openQuickAdd: (kind?: 'offer' | 'request') => void;
  closeQuickAdd: () => void;
  quickAddDefaultKind: 'offer' | 'request';
  /** currently inspected listing (details sheet) */
  viewingListing: Listing | null;
  setViewingListing: (l: Listing | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDefaultKind, setQuickAddDefaultKind] = useState<'offer' | 'request'>('offer');
  const [viewingListing, setViewingListing] = useState<Listing | null>(null);

  const openQuickAdd = useCallback((kind: 'offer' | 'request' = 'offer') => {
    setQuickAddDefaultKind(kind);
    setQuickAddOpen(true);
  }, []);
  const closeQuickAdd = useCallback(() => setQuickAddOpen(false), []);

  return (
    <AppContext.Provider
      value={{ quickAddOpen, openQuickAdd, closeQuickAdd, quickAddDefaultKind, viewingListing, setViewingListing }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
