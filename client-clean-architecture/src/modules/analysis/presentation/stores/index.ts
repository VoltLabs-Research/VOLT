import { create } from 'zustand';
import { createAnalysisSlice } from './slice';
import type { AnalysisSlice } from './slice';

export const useAnalysisStore = create<AnalysisSlice>()((...a) => ({
    ...createAnalysisSlice(...a)
}));

export * from './slice';
