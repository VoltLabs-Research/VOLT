import { create, type StateCreator } from 'zustand';
import { api } from '../services/api';
import { createAsyncAction } from '../utilities/asyncAction';

interface AuthState {
    user: any | null;
    isLoading: boolean;
    initializeAuth: () => Promise<void>;
    signIn: (credentials: Record<string, string>) => Promise<void>;
    signUp: (details: Record<string, string>) => Promise<void>;
    signOut: () => void;
}

const authStoreCreator: StateCreator<AuthState> = (set, get) => {
    const asyncAction = createAsyncAction(set, get);

    return {
        user: null,
        isLoading: true,

        initializeAuth: () => asyncAction(() => api.get('/auth/me'), {
            loadingKey: 'isLoading',
            onSuccess: (res) => ({ user: res.data.data })
        }),

        signIn: (credentials) => asyncAction(() => api.post('/auth/sign-in', credentials), {
            loadingKey: 'isLoading',
            onSuccess: (res) => {
                const { token, user } = res.data.data;
                localStorage.setItem('authToken', token);
                return { user };
            }
        }),

        signUp: (details) => asyncAction(() => api.post('/auth/sign-up', details), {
            loadingKey: 'isLoading',
            onSuccess: (res) => {
                // Duplicated code with sign in logic
                const { token, user } = res.data.data;
                localStorage.setItem('authToken', token);
                return { user };
            }
        }),

        signOut: () => {
            set({ isLoading: true });
            localStorage.removeItem('authToken');
            set({ user: null, isLoading: false });
        }
    }
};

const useAuthStore = create<AuthState>(authStoreCreator);

// Initial call to load user state from token
useAuthStore.getState().initializeAuth();

export default useAuthStore;