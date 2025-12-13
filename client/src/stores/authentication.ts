/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import { create } from 'zustand';
import { TokenStorage } from '@/utilities/storage';
import { createAsyncAction } from '@/utilities/asyncAction';
import { clearErrorHistory } from '@/api/error-notification';
import type { User } from '@/types/models';
import type { AuthState, AuthStore } from '@/types/stores/authentication';
import authApi from '@/services/api/auth';

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

    const handleAuthSuccess = (authData: { user: User; token: string }) => {
        const { token, user } = authData;
        TokenStorage.setToken(token);

        return { user };
    };

    return {
        ...initialState,

        initializeAuth() {
            const token = TokenStorage.getToken();
            if (!token) {
                return Promise.resolve({ user: null });
            }

            return asyncAction(() => authApi.getMe(), {
                loadingKey: 'isLoading',
                onSuccess: (user) => ({ user }),
                onError: () => {
                    TokenStorage.removeToken();
                    return { user: null };
                }
            });
        },

        signIn(credentials) {
            return asyncAction(() => authApi.signIn(credentials), {
                loadingKey: 'isLoading',
                onSuccess: handleAuthSuccess,
            });
        },

        signUp(details) {
            return asyncAction(() => authApi.signUp(details), {
                loadingKey: 'isLoading',
                onSuccess: handleAuthSuccess,
            });
        },

        signOut() {
            TokenStorage.removeToken();
            clearErrorHistory(); // Clear error history when user signs out
            set({ user: null, error: null });

            // Reload page to reset all stores and redirect to sign-in
            window.location.href = '/auth/sign-in';
        },

        clearError() {
            set({ error: null });
        },

        async changePassword(passwordData: { currentPassword: string; newPassword: string; confirmPassword: string }) {
            return asyncAction(() => authApi.password.change({ currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword }), {
                loadingKey: 'isChangingPassword',
                onSuccess: () => ({})
            });
        },

        async getPasswordInfo() {
            return asyncAction(() => authApi.password.getInfo(), {
                loadingKey: 'isLoadingPasswordInfo',
                onSuccess: (passwordInfo) => ({ passwordInfo })
            });
        }
    };
});

// Initial call to load user state from token
useAuthStore.getState().initializeAuth();

export default useAuthStore;