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
import { api } from '@/api';
import { createAsyncAction } from '@/utilities/asyncAction';
import type { ApiResponse } from '@/types/api';
import type { PreloadTask, RasterStore, RasterState } from '@/types/stores/raster';

const initialState: RasterState = {
    trajectory: null,
    isLoading: false,
    isAnalysisLoading: false,
    analyses: {},
    analysesNames: [],
    selectedAnalysis: null,
    error: null,
    loadingFrames: new Set<string>(),
    isPreloading: false,
    preloadProgress: 0,
    frameCache: {}
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

                console.log(analyses    );
                const analysesNames = Object.values(analyses).map((a: any) => ({
                    _id: a._id,
					name: `${a.identificationMode}${a.identificationMode === 'PTM' ? ` - RMSD: ${a.RMSD}` : ''}`,
                    description: `Circuit Size: ${a.maxTrialCircuitSize} - Stretchability: ${a.circuitStretchability}`,
                    RMSD: a.RMSD,
                    maxTrialCircuitSize: a.maxTrialCircuitSize,
                    circuitStretchability: a.circuitStretchability,
                    identificationMode: a.identificationMode
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

            // Serve from cache if available
            const cached = get().frameCache?.[cacheKey];
            if(cached){
                return cached;
            }
            set((state) => ({
                loadingFrames: new Set(state.loadingFrames).add(cacheKey)
            }));

            try{
				const res = await api.get(`/raster/${trajectoryId}/frame-data/${timestep}/${analysisId}/${model}`);
                const imageData = res.data?.data?.data;

                set((state) => {
                    const loadingFrames = new Set(state.loadingFrames);
                    loadingFrames.delete(cacheKey);
                    const frameCache = { ...(state.frameCache || {}) } as Record<string, string>;
                    if(imageData){
                        frameCache[cacheKey] = imageData;
                    }
                    return { loadingFrames, frameCache }
                });

                return imageData ?? null;
            }catch(e: any){
                const errorMessage = e?.context?.serverMessage || e?.message || 'Error loading frame';
                // Enhance context
                if (e?.context) {
                    e.context.trajectoryId = trajectoryId;
                    e.context.timestep = timestep;
                    e.context.analysisId = analysisId;
                    e.context.operation = 'loadRasterFrame';
                }
                set((state) => {
                    const loadingFrames = new Set(state.loadingFrames);
                    loadingFrames.delete(cacheKey);
                    return {
                        loadingFrames,
                        error: errorMessage
                    };
                });

                return null;
            }
        },

        getFrameCacheKey(timestep: number, analysisId: string, model: string){
			return `${timestep}-${analysisId}-${model}`;
        },

        clearFrameCache(){
            // Clear in-flight markers and memory cache
			set({ loadingFrames: new Set(), frameCache: {} });
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

                        // skip if we already have it cached
                        if(get().frameCache?.[key]) continue;

                        let score = 100;
                        // strongly prefer current and nearby frames, preview models, and priority models
                        if(currentTimestep !== undefined){
                            const d = Math.abs(timestep - currentTimestep);
                            if(d === 0) score -= 90;
                            else if(d <= 1) score -= 70;
                            else if(d <= 3) score -= 50;
                            else if(d <= 5) score -= 30;
                        }
                        if(priorityModels.ml && model === priorityModels.ml) score -= 40;
                        if(priorityModels.mr && model === priorityModels.mr) score -= 40;
                        if(model === 'preview') score -= 25;
                        if(model === 'dislocations') score -= 10;

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

            // Increase concurrency dynamically based on hardware threads (fallback 8)
            const hw = (typeof navigator !== 'undefined' && (navigator as any).hardwareConcurrency) || 8;
            const chunk = Math.max(6, Math.min(16, hw));
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
