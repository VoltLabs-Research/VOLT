import { create, type StateCreator } from 'zustand';
import { api } from '../services/api';
import { createAsyncAction } from '../utilities/asyncAction';
import type { ApiResponse, AuthResponsePayload } from '../types/api';
import type { User } from '../types/models';

interface AuthState {
    user: User | null;
    isLoading: boolean;
    error: string | null;
    initializeAuth: () => Promise<void>;
    signIn: (credentials: Record<string, string>) => Promise<void>;
    signUp: (details: Record<string, string>) => Promise<void>;
    signOut: () => void;
}

// Used for handle sign-in and sign-up
const handleUserData = (res: { data: ApiResponse<AuthResponsePayload> }) => {
    const { token, user } = res.data.data;
    localStorage.setItem('authToken', token);
    return { user };
};

const authStoreCreator: StateCreator<AuthState> = (set, get) => {
    const asyncAction = createAsyncAction(set, get);

    return {
        user: null,
        isLoading: true,
        error: null,

        initializeAuth: () => asyncAction(() => api.get<ApiResponse<User>>('/auth/me'), {
            loadingKey: 'isLoading',
            onSuccess: (res) => ({ user: res.data.data })
        }),

        signIn: (credentials) => asyncAction(() => api.post<ApiResponse<AuthResponsePayload>>('/auth/sign-in', credentials), {
            loadingKey: 'isLoading',
            onSuccess: handleUserData
        }),

        signUp: (details) => asyncAction(() => api.post<ApiResponse<AuthResponsePayload>>('/auth/sign-up', details), {
            loadingKey: 'isLoading',
            onSuccess: handleUserData
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