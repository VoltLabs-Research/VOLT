import { create } from 'zustand';
import type { Analysis } from '@/modules/analysis/domain/entities';

interface AnalysisConfigState {
    analysisConfig: Analysis | null;
    analysisConfigs: Analysis[];
}

interface AnalysisConfigActions {
    setAnalysisConfigs: (items: Analysis[]) => void;
    updateAnalysisConfig: (analysis?: Analysis | null) => void;
    resetAnalysisConfig: () => void;
}

type AnalysisConfigStore = AnalysisConfigState & AnalysisConfigActions;

const initialState: AnalysisConfigState = {
    analysisConfig: null,
    analysisConfigs: []
};

const useAnalysisConfigStore = create<AnalysisConfigStore>((set) => ({
    ...initialState,

    setAnalysisConfigs: (items) => set({ analysisConfigs: items }),

    updateAnalysisConfig: (analysis) => set({ analysisConfig: analysis ?? null }),

    resetAnalysisConfig: () => set({ analysisConfig: null })
}));

export default useAnalysisConfigStore;
