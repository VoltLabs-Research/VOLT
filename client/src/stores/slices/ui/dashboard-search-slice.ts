import type { StateCreator } from 'zustand';

export interface DashboardSearchState {
    query: string;
}

export interface DashboardSearchActions {
    setQuery: (q: string) => void;
    clearSearch: () => void;
}

export type DashboardSearchSlice = DashboardSearchState & DashboardSearchActions;

const initialState: DashboardSearchState = {
    query: ''
};

export const createDashboardSearchSlice: StateCreator<any, [], [], DashboardSearchSlice> = (set) => ({
    ...initialState,
    setQuery: (q) => set({ query: q }),
    clearSearch: () => set({ query: '' })
});

