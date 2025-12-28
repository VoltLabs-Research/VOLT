import { create } from 'zustand';
import { combineSlices } from '@/stores/helpers';
import { createAnalysisConfigSlice, type ExtendedAnalysisStore } from './analysis-slice';

export const useAnalysisConfigStore = create<ExtendedAnalysisStore>()(combineSlices(createAnalysisConfigSlice));

export { type ExtendedAnalysisStore } from './analysis-slice';
export default useAnalysisConfigStore;
