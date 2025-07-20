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
import type { ApiResponse, AuthResponsePayload } from '@/types/api';
import type { User } from '@/types/models';

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