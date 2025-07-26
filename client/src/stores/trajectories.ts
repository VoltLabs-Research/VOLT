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
    uploadingFileCount: number;
    error: string | null;
    
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

        getTrajectoryById: (id: string) => asyncAction(() => api.get<ApiResponse<Trajectory>>(`/trajectories/${id}?populate=team`), {
            loadingKey: 'isLoading',
            onSuccess: (res) => ({
                trajectory: res.data.data
            })
        }),

        deleteTrajectoryById: async (id: string) => {
            const originalTrajectories = get().trajectories;
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