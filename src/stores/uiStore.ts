import { create } from 'zustand';
import type { NavItem } from '@/types';

interface UIState {
  sidebarCollapsed: boolean;
  currentPage: NavItem;
  searchOpen: boolean;
  quickAddOpen: boolean;
  commandPaletteOpen: boolean;
  
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCurrentPage: (page: NavItem) => void;
  setSearchOpen: (open: boolean) => void;
  setQuickAddOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  currentPage: 'today',
  searchOpen: false,
  quickAddOpen: false,
  commandPaletteOpen: false,
  
  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },
  
  setSidebarCollapsed: (collapsed: boolean) => {
    set({ sidebarCollapsed: collapsed });
  },
  
  setCurrentPage: (page: NavItem) => {
    set({ currentPage: page });
  },
  
  setSearchOpen: (open: boolean) => {
    set({ searchOpen: open });
  },
  
  setQuickAddOpen: (open: boolean) => {
    set({ quickAddOpen: open });
  },
  
  setCommandPaletteOpen: (open: boolean) => {
    set({ commandPaletteOpen: open });
  },
}));
