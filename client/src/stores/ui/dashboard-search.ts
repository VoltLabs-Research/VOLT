import { create } from 'zustand';

interface DashboardSearchState {
  query: string;
  setQuery: (q: string) => void;
  clear: () => void;
}

const useDashboardSearchStore = create<DashboardSearchState>((set) => ({
  query: '',
  setQuery: (q) => set({ query: q }),
  clear: () => set({ query: '' })
}));

export default useDashboardSearchStore;
