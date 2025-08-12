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
import type { ApiResponse } from '@/types/api';
import { api } from '@/services/api';
import { createAsyncAction } from '@/utilities/asyncAction';

interface AnalysisConfigState{
    analysisConfig: AnalysisConfig | null,
    isLoading: boolean;
}

interface AnalysisConfigActions{
    setIsLoading: (loading: boolean) => void;
    setAnalysisConfig: (config: AnalysisConfig | null) => void;
    getAnalysisConfigById: (id: string) => Promise<void>;
}

const initialState = {
    analysisConfig: null,
    isLoading: true
};

export type AnalysisConfigStore = AnalysisConfigState & AnalysisConfigActions;

const useAnalysisConfigStore = create<AnalysisConfigStore>((set, get) => {
    const asyncAction = createAsyncAction(set, get);

    return {
            ...initialState,

        setIsLoading: (loading: boolean) => {
            set({ isLoading: loading });
        },

        setAnalysisConfig: (config: AnalysisConfig | null) => {
            set({ analysisConfig: config });
        },

        getAnalysisConfigById: (configId: string) => asyncAction(() => api.get<ApiResponse<AnalysisConfig>>(`/analysis-config/${configId}`), {
            loadingKey: 'isLoading',
            onSuccess: (res) => {
                const config = res.data.data;
                set({ analysisConfig: config });
            }
        })
    }
});

export default useAnalysisConfigStore;