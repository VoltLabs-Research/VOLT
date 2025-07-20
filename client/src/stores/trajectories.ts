import { create, type StateCreator } from 'zustand';
import { api, API_BASE_URL } from '../services/api';
import { createAsyncAction } from '../utilities/asyncAction';

interface TrajectoryState{
    trajectories: any[];
    trajectory: object;
    isLoading: boolean;
    isUploading: boolean;
    isUpdating: boolean;
    error: string | null;
    getTrajectoryById: (id: string) => Promise<void>;
    getTrajectories: () => Promise<void>;
    deleteTrajectoryById: (id: string) => Promise<void>;
    createTrajectory: (newTrajectoryData: any) => Promise<void>;
    updateTrajectoryById: (id: string, data: object) => Promise<void>;
}

const trajectoryStoreCreator: StateCreator<TrajectoryState> = (set, get) => {
    const asyncAction = createAsyncAction(set, get);

    return {
        trajectories: [],
        isLoading: true,
        isUploading: false,
        trajectory: {},
        error: null,

        getTrajectories: () => asyncAction(() => api.get('/trajectories'), {
            loadingKey: 'isLoading',
            onSuccess: (res) => ({ trajectories: res.data.data })
        }),

        getTrajectoryById: (id: string) => asyncAction(() => api.get(`/trajectories/${id}`), {
            loadingKey: 'isLoading',
            onSuccess: (res) => ({
                trajectory: res.data.data
            })
        }),

        deleteTrajectoryById: (id: string) => asyncAction(() => api.delete(`/trajectories/${id}`), {
            loadingKey: 'isLoading',
            onSuccess: (_, state) => ({
                trajectories: state.trajectories.filter((trajectory) => trajectory.id !== id)
            })
        }),

        updateTrajectoryById: (id: string, data: object) => asyncAction(() => api.patch(`/trajectories/${id}`, data), {
            loadingKey: 'isUpdating',
            onSuccess: (res, state) => {
                const updatedTrajectory = res.data.data;
                const newTrajectories = state.trajectories.map((trajectory) => trajectory._id === id ? updatedTrajectory : trajectory);
                return { trajectories: newTrajectories };
            }
        }),

        createTrajectory: (formData: FormData) => asyncAction(() => api.post('/trajectories', formData), {
            loadingKey: 'isUploading',
            onSuccess: (res, state) => ({
                trajectories: [...state.trajectories, res.data.data]
            })
        })
    }
};

const useTrajectoryStore = create<TrajectoryState>(trajectoryStoreCreator);

export default useTrajectoryStore;