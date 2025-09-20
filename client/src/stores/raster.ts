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
import { api } from '@/services/api';
import { createAsyncAction } from '@/utilities/asyncAction';
import type { ApiResponse } from '@/types/api';
import type { PreloadTask, RasterStore } from '@/types/stores/raster';

const initialState: Partial<RasterStore> = {
	trajectory: null,
	isLoading: false,
	isAnalysisLoading: false,
	analyses: {},
	analysesNames: [],
	selectedAnalysis: null,
	error: null,
	loadingFrames: new Set<string>(),
	isPreloading: false,
	preloadProgress: 0
};

const useRasterStore = create<RasterStore>((set, get) => {
	const asyncAction = createAsyncAction(set, get);

	return {
		...initialState,

        rasterize(id: string){
            const req = api.post<ApiResponse<any>>(`/raster/${id}/glb/`);

            return asyncAction(() => req, {
                loadingKey: 'isAnalysisLoading',
                onSuccess: (res) => ({ analyses: res.data.data.analyses })
            });
        },

        async getRasterFrames(id: string){
            set({ isLoading: true, error: null });
            
            try{
                const res = await api.get(`/raster/${id}/metadata`);
                const { analyses, trajectory } = res.data.data;

                const analysesNames = Object.values(analyses).map((a: any) => ({
                    _id: a._id,
					name: `${a.identificationMode}${a.identificationMode === 'PTM' ? ` - RMSD: ${a.RMSD}` : ''}`,
                    description: `Circuit Size: ${a.maxCircuitSize} - Stretchability: ${a.circuitStretchability}`
                }));

                set({
                    trajectory,
                    analyses,
                    analysesNames,
                    isLoading: false,
                    error: null,
                    selectedAnalysis: analysesNames.length > 0 ? analysesNames[0]._id : null
                });
            }catch(e: any){
                set({
                    isLoading: false,
                    error: e?.message ?? 'Unknown error'
                });
            }
        },

        async getRasterFrame(trajectoryId, timestep, analysisId, model){
            const cacheKey = get().getFrameCacheKey(timestep, analysisId, model);
            set((state) => ({
                loadingFrames: new Set(state.loadingFrames).add(cacheKey)
            }));

            try{
				const res = await api.get(`/raster/${trajectoryId}/frame-data/${timestep}/${analysisId}/${model}`);
                const imageData = res.data?.data?.data;

                set((state) => {
                    const loadingFrames = new Set(state.loadingFrames);
                    loadingFrames.delete(cacheKey);
                    return { loadingFrames }
                });

                return imageData ?? null;
            }catch(e: any){
                // TODO: duplicated
                set((state) => {
                    const loadingFrames = new Set(state.loadingFrames);
                    loadingFrames.delete(cacheKey);
                    return {
                        loadingFrames,
                        error: e?.message ?? 'Error loading frame'
                    };
                });

                return null;
            }
        },

        getFrameCacheKey(timestep: number, analysisId: string, model: string){
			return `${timestep}-${analysisId}-${model}`;
        },

        clearFrameCache(){
            // Not caching responses. This only clears in-flight makers.
			set({ loadingFrames: new Set() });
        },

        setSelectedAnalysis(id){
            set({ selectedAnalysis: id });
        },

        async preloadPriorizedFrames(trajectoryId, priorityModels, currentTimestep){
            const { analyses, getFrameCacheKey, loadingFrames, isPreloading } = get();
            
            if(!analyses || !Object.keys(analyses).length || isPreloading) return;

            set({ isPreloading: true, preloadProgress: 0 });
            
            const tasks: PreloadTask[] = [];
            for(const analysisId of Object.keys(analyses)){
                const frames = analyses[analysisId]?.frames || {};
                for(const timestepStr of Object.keys(frames)){
                    const timestep = parseInt(timestepStr, 10);
                    if(!Number.isFinite(timestep)) continue;
                    const models: string[] = frames[timestepStr]?.availableModels || [];
                    for(const model of models){
                        const key = getFrameCacheKey(timestep, analysisId, model);
                        // Avoid duplicate concurrent requests withing the same run, 
                        // but do NOT cache results between runs.
                        if(loadingFrames.has(key)) continue;

                        let score = 100;
						if(currentTimestep !== undefined && timestep === currentTimestep) score -= 80;
						if(priorityModels.ml && model === priorityModels.ml) score -= 30;
						if(priorityModels.mr && model === priorityModels.mr) score -= 30;
						if(model === 'dislocations') score -= 20;
						if(model === 'preview') score -= 5;

                        tasks.push({ timestep, analysisId, model, score });
                    }
                }
            }

            tasks.sort((a, b) => a.score - b.score);
            const total = tasks.length;
            if(!total){
                set({ isPreloading: false, preloadProgress: 100 });
                return;
            }

            let done = 0;
            const runBatch = async (batch: PreloadTask[]) => {
                await Promise.all(batch.map(async (task) => {
                    try{
                        await get().getRasterFrame(trajectoryId, task.timestep, task.analysisId, task.model);
                    }catch{
                        // ignore single task error
                    }finally{
                        done++;
                        const progress = Math.round((done / total) * 100);
                        set({ preloadProgress: progress });
                    }
                }));
            };

            const chunk = 4;
            for(let i = 0; i < tasks.length; i += chunk){
                await runBatch(tasks.slice(i, i + chunk));
            }

            set({
                isPreloading: false,
                preloadProgress: 100
            });
        },

        async preloadAllFrames(trajectoryId: string){
            return get().preloadPriorizedFrames(trajectoryId, {});
        }
	};
});

export default useRasterStore;
