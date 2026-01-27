import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import type { AnalysisConfig } from '../../domain/entities';

export interface AnalysisState {
    analysisConfig: AnalysisConfig | null;
}

export interface AnalysisActions {
    updateAnalysisConfig: (config: AnalysisConfig | null) => void;
    resetAnalysisConfig: () => void;
}

export type AnalysisSlice = AnalysisState & AnalysisActions;

export const initialState: AnalysisState = {
    analysisConfig: null
};

export const createAnalysisSlice: SliceCreator<AnalysisSlice> = (set) => ({
    ...initialState,
    updateAnalysisConfig: (config) => set({ analysisConfig: config }),
    resetAnalysisConfig: () => set({ analysisConfig: null })
});
