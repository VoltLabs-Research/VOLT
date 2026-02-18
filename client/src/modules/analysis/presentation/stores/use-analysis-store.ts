import { create } from 'zustand';
import type { Analysis } from '../../domain/entities';
import { deduplicateById } from '@/shared/domain/utils/deduplicateById';
import { createBaseSlice, BASE_SLICE_INITIAL_STATE, type BaseSlice } from '@/shared/presentation/stores/create-base-store-slice';

interface AnalysisStore extends BaseSlice {
    analyses: Analysis[];
    setAnalyses: (items: Analysis[]) => void;
    appendAnalyses: (items: Analysis[]) => void;
    removeAnalysis: (id: string) => void;
    reset: () => void;
};

const initialState = { analyses: [] as Analysis[], ...BASE_SLICE_INITIAL_STATE };

const useAnalysisStore = create<AnalysisStore>((set) => ({
    ...initialState,
    ...createBaseSlice(set),
    setAnalyses: (items) => set({ analyses: items }),
    appendAnalyses: (items) => set((s) => ({ analyses: deduplicateById(s.analyses, items) })),
    removeAnalysis: (id) => set((s) => ({ analyses: s.analyses.filter((a) => a._id !== id) })),
    reset: () => set(initialState)
}));

export default useAnalysisStore;
