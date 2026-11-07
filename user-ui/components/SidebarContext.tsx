'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

interface SidebarContextType {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextType>({ collapsed: false, toggle: () => {} });

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  const toggle = useCallback(() => {
    setCollapsed((p) => !p);
  }, []);

  useEffect(() => {
    const width = collapsed ? '72px' : '288px';
    document.documentElement.style.setProperty('--sidebar-width', width);
    return () => { document.documentElement.style.removeProperty('--sidebar-width'); };
  }, [collapsed]);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}
