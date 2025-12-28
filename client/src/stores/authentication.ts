/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
import { clearErrorHistory } from '@/api/error-notification';
import type { User } from '@/types/models';
import type { AuthState, AuthStore } from '@/types/stores/authentication';
import authApi from '@/services/api/auth';
import { extractErrorMessage } from '@/utilities/error-extractor';

const initialState: AuthState = {
    user: null,
    isLoading: false,
    error: null,
    passwordInfo: undefined,
    isChangingPassword: false,
    isLoadingPasswordInfo: false
};

const useAuthStore = create<AuthStore>()((set, get) => {
    const handleAuthSuccess = (authData: { user: User; token: string }) => {
        const { token, user } = authData;
        TokenStorage.setToken(token);
        set({ user, error: null });
        return { user };
    };

    return {
        ...initialState,

        initializeAuth: async () => {
            const token = TokenStorage.getToken();
            if(!token){
                set({ user: null });
                return { user: null };
            }

            set({ isLoading: true });

            try{
                const user = await authApi.getMe();
                set({ user, error: null });
                return { user };
            }catch(_error: any){
                TokenStorage.removeToken();
                set({ user: null });
                return { user: null };
            }finally{
                set({ isLoading: false });
            }
        },

        signIn: async (credentials) => {
            set({ isLoading: true, error: null });

            try{
                const authData = await authApi.signIn(credentials);
                return handleAuthSuccess(authData);
            }catch(error: any){
                const errorMessage = extractErrorMessage(error, 'Failed to sign in');
                set({ error: errorMessage });
                throw error;
            }finally{
                set({ isLoading: false });
            }
        },

        signUp: async (details) => {
            set({ isLoading: true, error: null });

            try{
                const authData = await authApi.signUp(details);
                return handleAuthSuccess(authData);
            }catch(error: any){
                const errorMessage = extractErrorMessage(error, 'Failed to sign up');
                set({ error: errorMessage });
                throw error;
            }finally{
                set({ isLoading: false });
            }
        },

        signOut: () => {
            TokenStorage.removeToken();
            clearErrorHistory();
            set({ user: null, error: null });
            window.location.href = '/auth/sign-in';
        },

        clearError: () => {
            set({ error: null });
        },

        changePassword: async (passwordData: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
            set({ isChangingPassword: true });

            try{
                await authApi.password.change({
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword
                });
                set({ error: null });
                return {};
            }catch(error: any){
                const errorMessage = extractErrorMessage(error, 'Failed to change password');
                set({ error: errorMessage });
                throw error;
            }finally{
                set({ isChangingPassword: false });
            }
        },

        getPasswordInfo: async () => {
            set({ isLoadingPasswordInfo: true });

            try{
                const passwordInfo = await authApi.password.getInfo();
                set({ passwordInfo, error: null });
                return { passwordInfo };
            }catch(error: any){
                const errorMessage = extractErrorMessage(error, 'Failed to load password info');
                set({ error: errorMessage });
                throw error;
            }finally{
                set({ isLoadingPasswordInfo: false });
            }
        }
    };
});

useAuthStore.getState().initializeAuth();

export default useAuthStore;
