import { create } from 'zustand';
import { combineSlices } from '@/stores/helpers';
import { createAnalysisConfigSlice } from '@/features/analysis/stores/slice';
import type { AnalysisConfigStore } from '@/types/stores/analysis-config';

export const useAnalysisConfigStore = create<AnalysisConfigStore>()(combineSlices(createAnalysisConfigSlice));

export default useAnalysisConfigStore;
