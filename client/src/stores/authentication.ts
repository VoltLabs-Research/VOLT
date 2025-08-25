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

import { create } from 'zustand';
import { TokenStorage } from '@/utilities/storage';
import { api } from '@/services/api';
import { createAsyncAction } from '@/utilities/asyncAction';
import type { ApiResponse, AuthResponsePayload } from '@/types/api';
import type { User } from '@/types/models';

interface AuthState {
    user: User | null;
    isLoading: boolean;
    error: string | null;
}

interface AuthActions{
    initializeAuth: () => Promise<void>;
    signIn: (credentials: Record<string, string>) => Promise<void>;
    signUp: (details: Record<string, string>) => Promise<void>;
    signOut: () => void;
    clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
    user: null,
    isLoading: false,
    error: null,
};

const useAuthStore = create<AuthStore>()((set, get) => {
    const asyncAction = createAsyncAction(set, get);

    const handleAuthSuccess = (res: { data: ApiResponse<AuthResponsePayload> }) => {
        const { token, user } = res.data.data;
        TokenStorage.setToken(token);

        return { user };
    };

    return {
        ...initialState,

        initializeAuth(){
            const req = api.get<ApiResponse<User>>('/auth/me');

            return asyncAction(() => req, {
                loadingKey: 'isLoading',
                onSuccess: (res) => ({ user: res.data.data }),
                onError: () => ({ user: null })
            });
        },

        signIn(credentials){
            const req = api.post<ApiResponse<AuthResponsePayload>>('/auth/sign-in', credentials);

            return asyncAction(() => req, {
                loadingKey: 'isLoading',
                onSuccess: handleAuthSuccess,
            });
        },

        signUp(details){
            const req = api.post<ApiResponse<AuthResponsePayload>>('/auth/sign-up', details);

            return asyncAction(() => req, {
                loadingKey: 'isLoading',
                onSuccess: handleAuthSuccess,
            });
        },

        signOut(){
            TokenStorage.removeToken();
            set({ user: null, error: null });
        },

        clearError(){
            set({ error: null });
        }
    };
});

// Initial call to load user state from token
useAuthStore.getState().initializeAuth();

export default useAuthStore;