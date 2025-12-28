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
    return {
        ...initialState,

        getAnalysisConfigs: async (teamId: string, opts = {}) => {
            const { page = 1, limit = 20, search = '', append = false } = opts;
            if(!teamId) throw new Error('No team ID provided');

            if(append){
                if(get().isFetchingMore) return;
                set({ isFetchingMore: true });
            }else{
                set({ isListingLoading: true });
            }

            try{
                const data = await analysisConfigApi.getByTeamId(teamId, { page, limit, q: search });

                const { data: analysisConfigs, listingMeta } = calculatePaginationState({
                    newData: (data.configs || []) as unknown as Analysis[],
                    currentData: get().analysisConfigs,
                    page,
                    limit,
                    append,
                    totalFromApi: data.total,
                    previousTotal: get().listingMeta.total
                });

                set({
                    analysisConfigs,
                    listingMeta,
                    error: null
                });
            }catch(error: any){
                set({
                    error: error?.message || 'Failed to load analysis configs'
                });
            }finally{
                if(append){
                    set({ isFetchingMore: false });
                }else{
                    set({ isListingLoading: false });
                }
            }
        },

        getDislocationsByAnalysisId: async (analysisId: string) => {
            set((state) => ({
                dislocationsLoading: true,
                dislocationsLoadingById: {
                    ...state.dislocationsLoadingById,
                    [analysisId]: true
                }
            }));

            try{
                const res: any = await analysisConfigApi.getDislocations(analysisId);
                set((state) => ({
                    analysisDislocationsById: {
                        ...state.analysisDislocationsById,
                        [analysisId]: res ?? []
                    },
                    dislocationsLoadingById: {
                        ...state.dislocationsLoadingById,
                        [analysisId]: false
                    },
                    dislocationsLoading: false
                }));
            }catch(_error: any){
                set((state) => ({
                    analysisDislocationsById: {
                        ...state.analysisDislocationsById,
                        [analysisId]: []
                    },
                    dislocationsLoadingById: {
                        ...state.dislocationsLoadingById,
                        [analysisId]: false
                    },
                    dislocationsLoading: false
                }));
            }
        },

        updateAnalysisConfig: (config?: Analysis | null) => {
            set({
                analysisConfig: config ?? null
            });
        },

        resetAnalysisConfig: () => {
            set({ analysisConfig: null });
        },

        setIsLoading: (loading: boolean) => {
            set({ isLoading: loading });
        }
    };
});

export default useAnalysisConfigStore;
