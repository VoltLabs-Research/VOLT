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
import type { ApiResponse } from '@/types/api';
import { createAsyncAction } from '@/utilities/asyncAction';
import { clearTrajectoryPreviewCache } from '@/hooks/trajectory/use-trajectory-preview';
import useTrajectoryStore from '@/stores/trajectories';
import { createTrajectoryGLBs } from '@/utilities/glb/modelUtils';
import useModelStore from './editor/model';
import type { ModifiersStore } from '@/types/stores/modifier';

const initialState = {
    isAnalysisLoading: false,
    isLoading: false,
    error: null
};

const createSeriesByTimestep = (stats: any[], key: string) => {
    const byTimestep = new Map<number, { x: number; y: number }[]>();
    stats.forEach((stat) => {
        if(!stat || typeof stat.rmsd !== 'number') return;
        const source = key === 'identificationRate' ? stat.structureAnalysis : stat.dislocations;
        
        if(!Array.isArray(source)) return;

        source.forEach((item: any) => {
            const t = Number(item?.timestep);
            const y = Number(item?.[key] ?? 0);
            
            if(!Number.isFinite(t)) return;
            
            const arr = byTimestep.get(t) ?? [];
            arr.push({ x: stat.rmsd, y });
            byTimestep.set(t, arr);
        });
    });

     return Array.from(byTimestep.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([timestep, points]) => ({
            label: `Timestep ${timestep}`,
            data: points
        }));
}

const useModifiersStore = create<ModifiersStore>()((set, get) => {
    const asyncAction = createAsyncAction(set, get);

    return {
        ...initialState,

        async structureIdentification(id: string, analysisConfig: any, identificationMode: string){
            const cpuIntensiveTasksEnabled = import.meta.env.VITE_CPU_INTENSIVE_TASKS === 'true';
            if (!cpuIntensiveTasksEnabled) {
                throw new Error('CPU-intensive tasks are disabled');
            }
            
            const config = { 
                ...analysisConfig, 
                structureIdentificationOnly: true,
                identificationMode
            };

            delete (config as any)._id;
            await api.post(`/structure-analysis/crystal-analysis/${id}`, config);  
        },

        dislocationRenderOptions: async (trajectoryId: string, timestep: string, analysisId: string, options: any) => {
            set({ isRenderOptionsLoading: true });
            
            try {
                const url = `/modifiers/render-options/dislocations/${trajectoryId}/${timestep}/${analysisId}`;
                await api.post(url, options);
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const currentTimestep = parseInt(timestep);
                const analysisIdNum = parseInt(analysisId);
                
                const glbs = createTrajectoryGLBs(
                    trajectoryId,
                    currentTimestep,
                    analysisIdNum
                );
                
                useModelStore.getState().selectModel(glbs);
                
                clearTrajectoryPreviewCache(trajectoryId);
                
                useTrajectoryStore.getState().clearCurrentTrajectory();
                
            } catch (error) {
                console.error('Error applying render options:', error);
                throw error;
            } finally {
                set({ isRenderOptionsLoading: false });
            }
        },

        // computeAnalysisDifferences
        computeAnalyses(id: string){
            const req = api.get<ApiResponse<any>>(`/modifiers/compute-analysis-differences/${id}`);

            return asyncAction(() => req, {
                isLoading: 'isAnalysisLoading',
                onSuccess(res){
                    const analysisStats = res.data.data;
                    const avgSegmentSeries = createSeriesByTimestep(analysisStats, 'averageSegmentLength');
                    const idRateSeries = createSeriesByTimestep(analysisStats, 'identificationRate');
                    const dislocationSeries = createSeriesByTimestep(analysisStats, 'totalSegments');
                    return {
                        analysisStats,
                        avgSegmentSeries,
                        idRateSeries,
                        dislocationSeries,
                        error: null
                    };
                }
            });
        },     

        async dislocationAnalysis(trajectoryId: string, analysisConfig: any){
            const cpuIntensiveTasksEnabled = import.meta.env.VITE_CPU_INTENSIVE_TASKS === 'true';
            if (!cpuIntensiveTasksEnabled) {
                throw new Error('CPU-intensive tasks are disabled');
            }
            
            delete analysisConfig._id;
            delete analysisConfig.trajectory;
            delete analysisConfig.structureAnalysis;
            delete analysisConfig.simulationCell;
            delete analysisConfig.dislocations;
            delete analysisConfig.__v;
            delete analysisConfig.updatedAt;
            delete analysisConfig.createdAt;
            await api.post(`/modifiers/crystal-analysis/${trajectoryId}`, analysisConfig);
        }
    };
});

export default useModifiersStore;