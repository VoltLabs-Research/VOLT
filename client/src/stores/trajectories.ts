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

import { create, type StateCreator } from 'zustand';
import { api } from '@/services/api';
import { createAsyncAction } from '@/utilities/asyncAction';
import type { Trajectory } from '@/types/models';
import type { ApiResponse } from '@/types/api';
import useEditorStore from './editor';

interface TrajectoryState{
    trajectories: Trajectory[];
    trajectory: Trajectory | null;
    isLoading: boolean;
    isSavingPreview: boolean;
    uploadingFileCount: number;
    error: string | null;
    
    previewBlobCache: Map<string, string>;
    previewLoadingCache: Map<string, boolean>;
    
    selectedTrajectories: string[];
    toggleTrajectorySelection: (id: string) => void;
    deleteSelectedTrajectories: () => Promise<void>;
    clearSelection: () => void;

    dislocationAnalysis: (id: string) => Promise<void>;
    setTrajectory: (trajectory: Trajectory | null) => void;
    getTrajectoryById: (id: string) => Promise<void>;
    getTrajectories: (teamId?: string) => Promise<void>;
    deleteTrajectoryById: (id: string) => Promise<void>;
    createTrajectory: (formData: FormData) => Promise<void>;
    updateTrajectoryById: (id: string, data: Partial<Pick<Trajectory, 'name'>>) => Promise<void>;
    saveTrajectoryPreview: (id: string, dataURL: string) => Promise<{ success: boolean; error?: string }>;
    getTrajectoryPreviewUrl: (id: string) => string | null;
    loadAuthenticatedPreview: (id: string) => Promise<string | null>;
    isPreviewLoading: (id: string) => boolean;
    clearPreviewCache: (id?: string) => void;
}

const trajectoryStoreCreator: StateCreator<TrajectoryState> = (set, get) => {
    const asyncAction = createAsyncAction(set, get);

    return {
        trajectories: [],
        isLoading: true,
        trajectory: null,
        error: null,
        uploadingFileCount: 0,
        selectedTrajectories: [],
        isSavingPreview: false,
        previewBlobCache: new Map(),
        previewLoadingCache: new Map(),

        saveTrajectoryPreview: async (id: string, dataURL: string) => {
            set({ isSavingPreview: true, error: null });
            
            try{
                console.log('Saving trajectory preview for ID:', id);
                
                const response = await fetch(dataURL);
                const blob = await response.blob();
                const formData = new FormData();
                formData.append('preview', blob, 'preview.png');
                
                const result = await api.patch<ApiResponse<Trajectory>>(`/trajectories/${id}`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });

                console.log('Preview saved successfully, server response:', result.data.data);

                const currentTrajectory = get().trajectory;
                const updatedTrajectories = get().trajectories.map((trajectory) => 
                    trajectory._id === id ? { ...trajectory, preview: result.data.data.preview } : trajectory
                );
                
                set({
                    trajectories: updatedTrajectories,
                    trajectory: currentTrajectory?._id === id ? { ...currentTrajectory, preview: result.data.data.preview } : currentTrajectory,
                    isSavingPreview: false 
                });

                return { success: true };
            }catch(error){
                console.error('Error saving preview:', error);
                set({ 
                    isSavingPreview: false,
                    // @ts-ignore
                    error: error.response?.data?.data?.error || 'Error saving preview'
                });
                return { 
                    success: false, 
                    error: error instanceof Error ? error.message : 'Unknown error' 
                };
            }
        },

        getTrajectoryPreviewUrl: (id: string) => {
            const trajectory = get().trajectories.find((trajectory) => trajectory._id === id) 
                            || (get().trajectory?._id === id ? get().trajectory : null);
            
            if(!trajectory || !trajectory.preview){
                return null;
            }
            
            return `/trajectories/${id}/preview`;
        },

        // TODO: rename
        loadAuthenticatedPreview: async (id: string): Promise<string | null> => {
            const { previewBlobCache, previewLoadingCache } = get();
            
            if(previewBlobCache.has(id)){
                return previewBlobCache.get(id) || null;
            }
            
            if(previewLoadingCache.get(id)){
                return new Promise((resolve) => {
                    const checkCache = () => {
                        if(previewBlobCache.has(id)){
                            resolve(previewBlobCache.get(id) || null);
                        }else if(!previewLoadingCache.get(id)){
                            resolve(null);
                        }else{
                            setTimeout(checkCache, 100);
                        }
                    };
                    checkCache();
                });
            }

            try{
                const newLoadingCache = new Map(previewLoadingCache);
                newLoadingCache.set(id, true);
                set({ previewLoadingCache: newLoadingCache });

                console.log('Loading authenticated preview for ID:', id);
                
                const response = await api.get(`/trajectories/${id}/preview`, {
                    responseType: 'blob'
                });
                
                const imageUrl = URL.createObjectURL(response.data);
                
                const newBlobCache = new Map(previewBlobCache);
                newBlobCache.set(id, imageUrl);
                
                const updatedLoadingCache = new Map(previewLoadingCache);
                updatedLoadingCache.delete(id);
                
                set({ 
                    previewBlobCache: newBlobCache,
                    previewLoadingCache: updatedLoadingCache
                });
                
                console.log('Preview loaded successfully for ID:', id);
                return imageUrl;
                
            }catch(error){
                console.error('Error loading authenticated preview:', error);

                const updatedLoadingCache = new Map(previewLoadingCache);
                updatedLoadingCache.delete(id);
                set({ previewLoadingCache: updatedLoadingCache });
                
                return null;
            }
        },

        isPreviewLoading: (id: string): boolean => {
            return get().previewLoadingCache.get(id) || false;
        },

        clearPreviewCache: (id?: string) => {
            const { previewBlobCache } = get();
            
            if(id){
                const blobUrl = previewBlobCache.get(id);
                if(blobUrl){
                    URL.revokeObjectURL(blobUrl);
                }
                
                const newBlobCache = new Map(previewBlobCache);
                newBlobCache.delete(id);
                
                const newLoadingCache = new Map(get().previewLoadingCache);
                newLoadingCache.delete(id);
                
                set({ 
                    previewBlobCache: newBlobCache,
                    previewLoadingCache: newLoadingCache
                });
            }else{
                previewBlobCache.forEach((blobUrl) => {
                    URL.revokeObjectURL(blobUrl);
                });
                
                set({ 
                    previewBlobCache: new Map(),
                    previewLoadingCache: new Map()
                });
            }
        },

        getTrajectories: (teamId?: string) => {
            let url = '/trajectories';
            if(teamId){
                url += `?teamId=${teamId}`;
            }

            return asyncAction(() => api.get<ApiResponse<Trajectory[]>>(url), {
                loadingKey: 'isLoading',
                onSuccess: (res) => ({ trajectories: res.data.data })
            });
        },

        setTrajectory: (trajectory: Trajectory | null) => {
            set({ trajectory });
        },

        getTrajectoryById: (id: string) => asyncAction(() => api.get<ApiResponse<Trajectory>>(`/trajectories/${id}?populate=team,dislocations`), {
            loadingKey: 'isLoading',
            onSuccess: (res) => ({
                trajectory: res.data.data
            })
        }),

        deleteTrajectoryById: async (id: string) => {
            const originalTrajectories = get().trajectories;
            
            get().clearPreviewCache(id);
            
            set({
                trajectories: originalTrajectories.filter((trajectory) => trajectory._id !== id)
            });

            try{
                await api.delete<ApiResponse<Trajectory>>(`/trajectories/${id}`);
            }catch(error){
                set({
                    trajectories: originalTrajectories,
                    error: 'Error trying to delete simulation'
                });
                console.error(error);
            }
        },

        toggleTrajectorySelection: (id: string) => {
            set((state) => {
                const isSelected = state.selectedTrajectories.includes(id);
                if(isSelected){
                    return { selectedTrajectories: state.selectedTrajectories.filter((selectedId) => selectedId !== id) };
                }else{
                    return { selectedTrajectories: [...state.selectedTrajectories, id] };
                }
            });
        },

        clearSelection: () => {
            set({ selectedTrajectories: [] });
        },

        deleteSelectedTrajectories: async () => {
            const { selectedTrajectories, deleteTrajectoryById } = get();
            if(selectedTrajectories.length === 0) return;

            const idsToDelete = [...selectedTrajectories];

            set({ selectedTrajectories: [] });

            for(const id of idsToDelete){
                deleteTrajectoryById(id);
            }
        },

        updateTrajectoryById: async (id, data) => {
            const originalTrajectories = get().trajectories;
            const updatedTrajectories = originalTrajectories.map((trajectory) => 
                trajectory._id === id ? { ...trajectory, ...data } : trajectory
            );
            set({ trajectories: updatedTrajectories });
            try{
                await api.patch<ApiResponse<Trajectory>>(`/trajectories/${id}`, data);
            }catch(error){
                set({ 
                    trajectories: originalTrajectories, 
                    error: `Error trying to update trajectory.` 
                });
                console.error(error);
            }
        },

        dislocationAnalysis: async (id: string) => api.post<ApiResponse<any>>(`/dislocations/trajectory/${id}`, useEditorStore.getState().analysisConfig),

        createTrajectory: async (formData: FormData) => {
            const currentFileCount = get().uploadingFileCount;
            set({ uploadingFileCount: currentFileCount + 1, error: null });
            
            try{
                const response = await api.post<ApiResponse<any>>('/trajectories', formData);
                const currentTrajectories = get().trajectories;
                const newCount = get().uploadingFileCount - 1;
                
                set({ 
                    trajectories: [response.data.data, ...currentTrajectories],
                    uploadingFileCount: Math.max(0, newCount)
                });
                
                return response.data;
            }catch(error){
                const newCount = get().uploadingFileCount - 1;
                set({ 
                    uploadingFileCount: Math.max(0, newCount),
                    // @ts-ignore
                    error: error.response?.data?.data?.error || 'Error uploading.' 
                });
                
                throw error;
            }
        }
    }
};

const useTrajectoryStore = create<TrajectoryState>(trajectoryStoreCreator);

export default useTrajectoryStore;