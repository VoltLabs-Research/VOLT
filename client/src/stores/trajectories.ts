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

interface TrajectoryState{
    trajectories: Trajectory[];
    trajectory: Trajectory | null;
    isLoading: boolean;
    isUploading: boolean;
    isUpdating: boolean;
    error: string | null;

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
        isUploading: false,
        trajectory: null,
        isUpdating: false,
        error: null,

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

        getTrajectoryById: (id: string) => asyncAction(() => api.get<ApiResponse<Trajectory>>(`/trajectories/${id}`), {
            loadingKey: 'isLoading',
            onSuccess: (res) => ({
                trajectory: res.data.data
            })
        }),

        deleteTrajectoryById: (id: string) => asyncAction(() => api.delete<ApiResponse<Trajectory>>(`/trajectories/${id}`), {
            loadingKey: 'isLoading',
            onSuccess: (_, state) => ({
                trajectories: state.trajectories.filter((trajectory) => trajectory._id !== id)
            })
        }),

        updateTrajectoryById: (id, data) => asyncAction(() => api.patch<ApiResponse<Trajectory>>(`/trajectories/${id}`, data), {
            loadingKey: 'isUpdating',
            onSuccess: (res, state) => {
                const updatedTrajectory = res.data.data;
                const newTrajectories = state.trajectories.map((trajectory) => trajectory._id === id ? updatedTrajectory : trajectory);
                return { trajectories: newTrajectories };
            }
        }),

        createTrajectory: (formData: FormData) => asyncAction(() => api.post<ApiResponse<Trajectory>>('/trajectories', formData), {
            loadingKey: 'isUploading',
            onSuccess: (res, state) => ({
                trajectories: [...state.trajectories, res.data.data]
            })
        })
    }
};

const useTrajectoryStore = create<TrajectoryState>(trajectoryStoreCreator);

export default useTrajectoryStore;