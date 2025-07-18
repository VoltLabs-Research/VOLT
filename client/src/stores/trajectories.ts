import { create, type StateCreator } from 'zustand';
import { api, API_BASE_URL } from '../services/api';
import { createAsyncAction } from '../utilities/asyncAction';

interface TrajectoryState{
    trajectories: any[];
    isLoading: boolean;
    isUploading: boolean;
    error: string | null;
    getTrajectories: () => Promise<void>;
    deleteTrajectory: (id: string) => Promise<void>;
    createTrajectory: (newTrajectoryData: any) => Promise<void>;
}

const trajectoryStoreCreator: StateCreator<TrajectoryState> = (set, get) => {
    const asyncAction = createAsyncAction(set, get);

    return {
        trajectories: [],
        isLoading: true,
        isUploading: false,
        error: null,

        getTrajectories: () => asyncAction(() => api.get(`${API_BASE_URL}/trajectories`), {
            loadingKey: 'isLoading',
            onSuccess: (res) => ({ trajectories: res.data.data })
        }),

        deleteTrajectory: (id: string) => asyncAction(() => api.delete(`${API_BASE_URL}/trajectories/${id}`), {
            loadingKey: 'isLoading',
            onSuccess: (_, state) => ({
                trajectories: state.trajectories.filter((trajectory) => trajectory.id !== id)
            })
        }),

        createTrajectory: (formData: FormData) => asyncAction(() => api.post(`${API_BASE_URL}/trajectories`, formData), {
            loadingKey: 'isUploading',
            onSuccess: (res, state) => ({
                trajectories: [...state.trajectories, res.data.data]
            })
        })
    }
};

const useTrajectoryStore = create<TrajectoryState>(trajectoryStoreCreator);

export default useTrajectoryStore;