import { create } from 'zustand';
import { api } from '../services/api';

interface AuthState {
    user: any | null;
    isLoading: boolean;
    initializeAuth: () => Promise<void>;
    signIn: (credentials: Record<string, string>) => Promise<void>;
    signUp: (details: Record<string, string>) => Promise<void>;
    signOut: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    isLoading: true,

    initializeAuth: async () => {
        const token = localStorage.getItem('authToken');
        if(token){
            try{
                const response = await api.get('/auth/me');
                set({ user: response.data.data });
            }catch{
                localStorage.removeItem('authToken');
                set({ user: null });
            }
        }
        set({ isLoading: false });
    },

    signIn: async (credentials) => {
        set({ isLoading: true });
        const response = await api.post('/auth/sign-in', credentials);
        const { token, user } = response.data.data;
        localStorage.setItem('authToken', token);
        set({ user: user, isLoading: false });
    },

    signUp: async (details) => {
        set({ isLoading: true });
        const response = await api.post('/auth/sign-up', details);
        const { token, user } = response.data.data;
        localStorage.setItem('authToken', token);
        set({ user: user, isLoading: false });
    },

    signOut: () => {
        set({ isLoading: true });
        localStorage.removeItem('authToken');
        set({ user: null, isLoading: false });
    },
}));

// Initial call to load user state from token
useAuthStore.getState().initializeAuth();