import { create, type StateCreator } from 'zustand';
import { api } from '../services/api';
import { createAsyncAction } from '../utilities/asyncAction';
import type { Trajectory } from '../types/models';
import type { ApiResponse } from '../types/api';

interface TrajectoryState{
    trajectories: Trajectory[];
    trajectory: Trajectory | null;
    isLoading: boolean;
    isUploading: boolean;
    isUpdating: boolean;
    error: string | null;

    getTrajectoryById: (id: string) => Promise<void>;
    getTrajectories: () => Promise<void>;
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

        getTrajectories: () => asyncAction(() => api.get<ApiResponse<Trajectory[]>>('/trajectories'), {
            loadingKey: 'isLoading',
            onSuccess: (res) => ({ trajectories: res.data.data })
        }),

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