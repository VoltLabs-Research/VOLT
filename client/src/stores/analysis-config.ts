/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import { create } from 'zustand';
import type { AnalysisConfig } from '@/types/models';
import type { AnalysisConfigStore } from '@/types/stores/analysis-config';

const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
    crystalStructure: 'BCC',
    identificationMode: 'CNA',
    maxTrialCircuitSize: 14.0,
    circuitStretchability: 9.0,
    RMSD: 0.10,
    defectMeshSmoothingLevel: 8,
    lineSmoothingLevel: 5,
    linePointInterval: 2.5,
    onlyPerfectDislocations: false,
    markCoreAtoms: false,
    structureIdentificationOnly: false
};

const initialState = {
    analysisConfig: DEFAULT_ANALYSIS_CONFIG,
    isLoading: true
};

const useAnalysisConfigStore = create<AnalysisConfigStore>((set, get) => {
    // const asyncAction = createAsyncAction(set, get);

    return {
        ...initialState,

        setAnalysisConfig(key: string, value: any){
            const currentConfig = get().analysisConfig;
            set({
                analysisConfig: { ...currentConfig, [key]: value },
            });
        },

        updateAnalysisConfig(config: Partial<AnalysisConfig>){
            const currentConfig = get().analysisConfig;
            set({
                analysisConfig: { ...currentConfig, ...config },
            });
        },

        resetAnalysisConfig(){
            set({ analysisConfig: DEFAULT_ANALYSIS_CONFIG });
        },

        setIsLoading(loading: boolean){
            set({ isLoading: loading });
        },
    }
});

export default useAnalysisConfigStore;