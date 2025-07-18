import { create } from 'zustand';
import { api, API_BASE_URL } from '../services/api';

interface TrajectoryState{
    trajectories: any[];
    isLoading: boolean;
    isUploading: boolean;
    error: string | null;
    getTrajectories: () => Promise<void>;
    deleteTrajectory: (id: string) => Promise<void>;
    createTrajectory: (newTrajectoryData: any) => Promise<void>;
}

const useTrajectoryStore = create<TrajectoryState>((set, get) => ({
    trajectories: [],
    isLoading: true,
    isUploading: false,
    error: null,

    getTrajectories: async () => {
        set({ isLoading: true, error: null });
        try{
            const response = await api.get(`${API_BASE_URL}/trajectories`);
            set({ trajectories: response.data.data, isLoading: false });
        }catch(err: any){
            const errorData = err.response?.data?.message || err.message;
            set({ error: errorData, isLoading: false });
        }
    },

    deleteTrajectory: async (id: string) => {
        set({ isLoading: true, error: null });
        try{
            await api.delete(`${API_BASE_URL}/trajectories/${id}`);
            set((state) => ({
                trajectories: state.trajectories.filter(t => t.id !== id),
                isLoading: false
            }));
        }catch(err: any){
            const errorData = err.response?.data?.message || err.message;
            set({ error: errorData, isLoading: false });
            throw errorData;
        }
    },

    createTrajectory: async (formData: FormData) => {
        set({ isUploading: true, error: null });
        try{
            const response = await api.post(`${API_BASE_URL}/trajectories`, formData);
            // the response is an object that contains the created trajectory data
            set((state) => ({
                trajectories: [...state.trajectories, response.data.data],
                isUploading: false
            }));
        }catch(err: any){
            const errorData = err.response?.data?.message || err.message;
            set({ error: errorData, isUploading: false });
            throw errorData;
        }
    }
}));

export default useTrajectoryStore;