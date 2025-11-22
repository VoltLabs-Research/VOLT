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
import type { Analysis } from '@/types/models';
import type { AnalysisConfigStore } from '@/types/stores/analysis-config';
import type { ApiResponse } from '@/types/api';
import { api } from '@/api';
import { createAsyncAction } from '@/utilities/asyncAction';

const initialState = {
  analysisConfig: null as Analysis | null,
  isLoading: true,
  error: null as string | null,
  dislocationsLoading: false,
  analysisDislocationsById: {} as Record<string, any[]>,
  dislocationsLoadingById: {} as Record<string, boolean>
};

const useAnalysisConfigStore = create<AnalysisConfigStore & {
  analysisDislocationsById: Record<string, any[]>;
  dislocationsLoadingById: Record<string, boolean>;
  getDislocationsByAnalysisId: (analysisId: string) => Promise<void>;
}>((set, get) => {
  const asyncAction = createAsyncAction(set, get);

  return {
    ...initialState,

    async getDislocationsByAnalysisId(analysisId: string){
      const req = api.get<ApiResponse<any>>(`/analysis-config/${analysisId}/dislocations`);
      set((state) => ({
        dislocationsLoadingById: {
          ...state.dislocationsLoadingById,
          [analysisId]: true
        }
      }));

      return asyncAction(() => req, {
        loadingKey: 'dislocationsLoading', 
        onSuccess: (res: any, state) => {
          const current = state.analysisDislocationsById || {};
          const currentLoading = state.dislocationsLoadingById || {};
          return {
            analysisDislocationsById: {
              ...current,
              [analysisId]: res.data?.data ?? []
            },
            dislocationsLoadingById: {
              ...currentLoading,
              [analysisId]: false
            }
          };
        },
        onError: (_error, state) => {
          const current = state.analysisDislocationsById || {};
          const currentLoading = state.dislocationsLoadingById || {};
          return {
            analysisDislocationsById: {
              ...current,
              [analysisId]: []
            },
            dislocationsLoadingById: {
              ...currentLoading,
              [analysisId]: false
            }
          };
        }
      });
    },

    updateAnalysisConfig(config?: Analysis | null){
      set({
        analysisConfig: config ?? null
      });
    },

    resetAnalysisConfig(){
      set({ analysisConfig: null });
    },

    setIsLoading(loading: boolean){
      set({ isLoading: loading });
    },
  }
});

export default useAnalysisConfigStore;
