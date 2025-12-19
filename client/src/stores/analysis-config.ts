/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
 */

import { create } from 'zustand';
import type { Analysis } from '@/types/models';
import type { AnalysisConfigStore } from '@/types/stores/analysis-config';
import analysisConfigApi from '@/services/api/analysis-config';
import { createAsyncAction } from '@/utilities/asyncAction';
import { calculatePaginationState, initialListingMeta } from '@/utilities/pagination-utils';

const initialState = {
  analysisConfig: null as Analysis | null,
  analysisConfigs: [] as Analysis[],
  listingMeta: initialListingMeta,
  isLoading: true,
  isFetchingMore: false,
  isListingLoading: false,
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

    getAnalysisConfigs: (teamId: string, opts = {}) => {
      const { page = 1, limit = 20, search = '', append = false } = opts;
      if(!teamId) return Promise.reject("No team ID provided");

      return asyncAction(() => analysisConfigApi.getByTeamId(teamId, { page, limit, q: search }), {
        loadingKey: 'isListingLoading',
        onSuccess: (data, state) => {
          const { data: analysisConfigs, listingMeta } = calculatePaginationState({
            newData: (data.configs || []) as unknown as Analysis[],
            currentData: state.analysisConfigs,
            page,
            limit,
            append,
            totalFromApi: data.total,
            previousTotal: state.listingMeta.total
          });

          return {
            analysisConfigs,
            listingMeta,
            error: null
          };
        },
        onError: (error) => ({
          error: error?.message || 'Failed to load analysis configs'
        })
      });
    },

    async getDislocationsByAnalysisId(analysisId: string) {
      const req = analysisConfigApi.getDislocations(analysisId);
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
              [analysisId]: res ?? []
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

    updateAnalysisConfig(config?: Analysis | null) {
      set({
        analysisConfig: config ?? null
      });
    },

    resetAnalysisConfig() {
      set({ analysisConfig: null });
    },

    setIsLoading(loading: boolean) {
      set({ isLoading: loading });
    },
  }
});

export default useAnalysisConfigStore;
