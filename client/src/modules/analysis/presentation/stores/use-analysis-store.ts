import { create } from 'zustand';
import type { Analysis } from '../../domain/entities';

interface AnalysisStore {
    analyses: Analysis[];
    isLoading: boolean;
    error: string | null;
    setAnalyses: (items: Analysis[]) => void;
    appendAnalyses: (items: Analysis[]) => void;
    removeAnalysis: (id: string) => void;
    setLoading: (value: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
};

const initialState = { analyses: [] as Analysis[], isLoading: false, error: null as string | null };

const useAnalysisStore = create<AnalysisStore>((set) => ({
    ...initialState,
    setAnalyses: (items) => set({ analyses: items }),
    appendAnalyses: (items) => set((s) => {
        const ids = new Set(s.analyses.map(a => a._id));
        return { analyses: [...s.analyses, ...items.filter(a => !ids.has(a._id))] };
    }),
    removeAnalysis: (id) => set((s) => ({ analyses: s.analyses.filter((a) => a._id !== id) })),
    setLoading: (value) => set({ isLoading: value }),
    setError: (error) => set({ error }),
    reset: () => set(initialState)
}));

export default useAnalysisStore;
