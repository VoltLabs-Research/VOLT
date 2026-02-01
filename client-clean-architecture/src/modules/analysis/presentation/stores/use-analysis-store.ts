import { create } from 'zustand';
import type { Analysis } from '../../domain/entities';

interface AnalysisState {
    analyses: Analysis[];
    isLoading: boolean;
    error: string | null;
};

interface AnalysisActions {
    setAnalyses: (items: Analysis[]) => void;
    appendAnalyses: (items: Analysis[]) => void;
    removeAnalysis: (id: string) => void;
    setLoading: (value: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
};

type AnalysisStore = AnalysisState & AnalysisActions;

const initialState: AnalysisState = {
    analyses: [],
    isLoading: false,
    error: null
};

const useAnalysisStore = create<AnalysisStore>((set) => ({
    ...initialState,

    setAnalyses: (items) => set({ analyses: items }),

    appendAnalyses: (items) => set((state) => {
        const existingIds = new Set(state.analyses.map(a => a._id));
        const uniqueNewItems = items.filter(a => !existingIds.has(a._id));
        return {
            analyses: [...state.analyses, ...uniqueNewItems]
        };
    }),

    removeAnalysis: (id) => set((state) => ({
        analyses: state.analyses.filter((a) => a._id !== id)
    })),

    setLoading: (value) => set({ isLoading: value }),

    setError: (error) => set({ error }),

    reset: () => set(initialState)
}));

export default useAnalysisStore;
