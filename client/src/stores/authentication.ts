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
import { api } from '@/api';
import { createAsyncAction } from '@/utilities/asyncAction';
import { clearErrorHistory } from '@/api/error-notification';
import type { ApiResponse, AuthResponsePayload } from '@/types/api';
import type { User } from '@/types/models';
import type { AuthState, AuthStore } from '@/types/stores/authentication';

const initialState: AuthState = {
    user: null,
    isLoading: false,
    error: null,
    passwordInfo: undefined,
    isChangingPassword: false,
    isLoadingPasswordInfo: false,
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
            // Verificar primero si hay un token
            const token = TokenStorage.getToken();
            if (!token) {
                return Promise.resolve({ user: null });
            }
            
            const req = api.get<ApiResponse<User>>('/auth/me');

            return asyncAction(() => req, {
                loadingKey: 'isLoading',
                onSuccess: (res) => ({ user: res.data.data }),
                onError: () => {
                    // Si hay error, limpiar el token
                    TokenStorage.removeToken();
                    return { user: null };
                }
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
            clearErrorHistory(); // Clear error history when user signs out
            set({ user: null, error: null });
        },

        clearError(){
            set({ error: null });
        },

        async changePassword(passwordData: { currentPassword: string; newPassword: string; confirmPassword: string }) {
            const req = api.put('/password/change', passwordData);
            
            return asyncAction(() => req, {
                loadingKey: 'isChangingPassword',
                onSuccess: () => {
                    // Password changed successfully, no need to update user state
                    return {};
                }
            });
        },

        async getPasswordInfo() {
            const req = api.get('/password/info');
            
            return asyncAction(() => req, {
                loadingKey: 'isLoadingPasswordInfo',
                onSuccess: (res) => {
                    // Return password info without updating user state
                    return { passwordInfo: res.data.data };
                }
            });
        }
    };
});

// Initial call to load user state from token
useAuthStore.getState().initializeAuth();

export default useAuthStore;