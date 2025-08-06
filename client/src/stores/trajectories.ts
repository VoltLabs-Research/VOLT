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
import type { Trajectory } from '@/types/models';
import type { ApiResponse } from '@/types/api';
import PreviewCacheService from '@/services/preview-cache-service';
import { clearTrajectoryPreviewCache } from '@/hooks/trajectory/use-trajectory-preview';
import Logger from '@/services/logger';

interface TrajectoryState {
    trajectories: Trajectory[];
    trajectory: Trajectory | null;
    isLoading: boolean;
    isSavingPreview: boolean;
    uploadingFileCount: number;
    error: string | null;
    selectedTrajectories: string[];
}

interface TrajectoryActions {
    getTrajectories: (teamId?: string) => Promise<void>;
    getTrajectoryById: (id: string) => Promise<void>;
    createTrajectory: (formData: FormData) => Promise<void>;
    updateTrajectoryById: (id: string, data: Partial<Pick<Trajectory, 'name'>>) => Promise<void>;
    deleteTrajectoryById: (id: string) => Promise<void>;
    
    // Selection management
    toggleTrajectorySelection: (id: string) => void;
    deleteSelectedTrajectories: () => Promise<void>;
    clearSelection: () => void;
    
    // Preview management
    saveTrajectoryPreview: (id: string, dataURL: string) => Promise<{ success: boolean; error?: string }>;
    getTrajectoryPreviewUrl: (id: string) => string | null;
    loadAuthenticatedPreview: (id: string) => Promise<string | null>;
    isPreviewLoading: (id: string) => boolean;
    clearPreviewCache: (id?: string) => void;
    
    // Analysis
    dislocationAnalysis: (id: string, analysisConfig: any) => Promise<void>;
    
    // State management
    setTrajectory: (trajectory: Trajectory | null) => void;
    clearError: () => void;
    reset: () => void;
    clearCurrentTrajectory: () => void;
}

export type TrajectoryStore = TrajectoryState & TrajectoryActions;

const initialState: TrajectoryState = {
    trajectories: [],
    trajectory: null,
    isLoading: true,
    isSavingPreview: false,
    uploadingFileCount: 0,
    error: null,
    selectedTrajectories: [],
};

const previewCache = new PreviewCacheService();

const useTrajectoryStore = create<TrajectoryStore>()((set, get) => {
    const asyncAction = createAsyncAction(set, get);
    const logger = new Logger('use-trajectory-store');

    const updateTrajectoryInList = (id: string, updates: Partial<Trajectory>) => {
        const currentTrajectories = get().trajectories;
        const currentTrajectory = get().trajectory;
        
        return {
            trajectories: currentTrajectories.map(trajectory =>
                trajectory._id === id ? { ...trajectory, ...updates } : trajectory
            ),
            trajectory: currentTrajectory?._id === id 
                ? { ...currentTrajectory, ...updates } 
                : currentTrajectory
        };
    };

    const removeTrajectoryFromList = (id: string) => {
        const currentTrajectories = get().trajectories;
        const currentTrajectory = get().trajectory;
        
        return {
            trajectories: currentTrajectories.filter(t => t._id !== id),
            trajectory: currentTrajectory?._id === id ? null : currentTrajectory
        };
    };

    return {
        ...initialState,

        getTrajectories: (teamId?: string) => {
            const url = teamId ? `/trajectories?teamId=${teamId}` : '/trajectories';
            
            return asyncAction(() => api.get<ApiResponse<Trajectory[]>>(url),
                {
                    loadingKey: 'isLoading',
                    onSuccess: (res) => ({ 
                        trajectories: res.data.data,
                        error: null 
                    }),
                    onError: (error) => ({
                        error: error?.response?.data?.message || 'Failed to load trajectories'
                    })
                }
            );
        },

        getTrajectoryById: (id: string) => asyncAction(() => api.get<ApiResponse<Trajectory>>(`/trajectories/${id}?populate=team`),
            {
                loadingKey: 'isLoading',
                onSuccess: (res) => ({
                    trajectory: res.data.data,
                    error: null
                }),
                onError: (error) => ({
                    error: error?.response?.data?.message || 'Failed to load trajectory'
                })
            }
        ),

        createTrajectory: async (formData: FormData) => {
            const currentFileCount = get().uploadingFileCount;
            set({ uploadingFileCount: currentFileCount + 1, error: null });
            
            try{
                const response = await api.post<ApiResponse<Trajectory>>('/trajectories', formData);
                const newTrajectory = response.data.data;
                const currentTrajectories = get().trajectories;
                
                set({ 
                    trajectories: [newTrajectory, ...currentTrajectories],
                    uploadingFileCount: Math.max(0, get().uploadingFileCount - 1),
                    error: null
                });
                
                return response.data;
            }catch(error: any){
                set({ 
                    uploadingFileCount: Math.max(0, get().uploadingFileCount - 1),
                    error: error?.response?.data?.message || 'Error uploading trajectory'
                });
                throw error;
            }
        },

        updateTrajectoryById: async (id: string, data: Partial<Pick<Trajectory, 'name'>>) => {
            const originalState = { 
                trajectories: get().trajectories, 
                trajectory: get().trajectory 
            };
            
            set(updateTrajectoryInList(id, data));
            
            try{
                await api.patch<ApiResponse<Trajectory>>(`/trajectories/${id}`, data);
            }catch(error: any){
                set(originalState);
                set({ 
                    error: error?.response?.data?.message || 'Failed to update trajectory'
                });
                throw error;
            }
        },

        deleteTrajectoryById: async (id: string) => {
            const originalState = { 
                trajectories: get().trajectories, 
                trajectory: get().trajectory 
            };
            
            set(removeTrajectoryFromList(id));
            clearTrajectoryPreviewCache(id);
            
            try{
                await api.delete(`/trajectories/${id}`);
            }catch(error: any){
                set(originalState);
                set({ 
                    error: error?.response?.data?.message || 'Failed to delete trajectory'
                });
                throw error;
            }
        },

        toggleTrajectorySelection: (id: string) => {
            const currentSelected = get().selectedTrajectories;
            const isSelected = currentSelected.includes(id);
            
            set({
                selectedTrajectories: isSelected
                    ? currentSelected.filter(selectedId => selectedId !== id)
                    : [...currentSelected, id]
            });
        },

        clearSelection: () => set({ selectedTrajectories: [] }),

        deleteSelectedTrajectories: async () => {
            const { selectedTrajectories } = get();
            if(selectedTrajectories.length === 0) return;

            const idsToDelete = [...selectedTrajectories];
            set({ selectedTrajectories: [] });

            const deletePromises = idsToDelete.map(id => 
                get().deleteTrajectoryById(id).catch((error) => 
                    logger.error(`Failed to delete trajectory ${id}:`, error)));
            
            await Promise.allSettled(deletePromises);
        },

        saveTrajectoryPreview: async (id: string, dataURL: string) => {
            set({ isSavingPreview: true, error: null });
            
            try{
                const response = await fetch(dataURL);
                const blob = await response.blob();
                const formData = new FormData();
                formData.append('preview', blob, 'preview.png');
                
                const result = await api.patch<ApiResponse<Trajectory>>(
                    `/trajectories/${id}`, 
                    formData,
                    {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    }
                );

                const updatedTrajectory = result.data.data;
                clearTrajectoryPreviewCache(id);

                set({
                    ...updateTrajectoryInList(id, { 
                        preview: updatedTrajectory.preview,
                        updatedAt: updatedTrajectory.updatedAt
                    }),
                    isSavingPreview: false
                });

                return { success: true };
            }catch(error: any){
                set({ 
                    isSavingPreview: false,
                    error: error?.response?.data?.message || 'Error saving preview'
                });
                
                return { 
                    success: false, 
                    error: error?.message || 'Unknown error' 
                };
            }
        },

        getTrajectoryPreviewUrl: (id: string) => {
            const trajectory = get().trajectories.find(t => t._id === id) 
                || (get().trajectory?._id === id ? get().trajectory : null);
            
            return trajectory?.preview ? `/trajectories/${id}/preview` : null;
        },

        loadAuthenticatedPreview: (id: string) => previewCache.loadPreview(id),

        isPreviewLoading: (id: string) => previewCache.isLoading(id),

        clearPreviewCache: (id?: string) => previewCache.clear(id),

        dislocationAnalysis: async (id: string, analysisConfig: any) => {
            try{
                await api.post(`/dislocations/trajectory/${id}`, analysisConfig);
            }catch(error: any){
                set({ 
                    error: error?.response?.data?.message || 'Analysis failed'
                });
                throw error;
            }
        },

        setTrajectory: (trajectory: Trajectory | null) => set({ trajectory }),

        clearError: () => set({ error: null }),
            clearCurrentTrajectory: () => {

            set({ 
                trajectory: null,
                error: null,
                selectedTrajectories: [],
            });
        },

        reset: () => {
            previewCache.clear();
            set(initialState);
        },
    };
});

export default useTrajectoryStore;