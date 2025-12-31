import { TokenStorage } from '@/utilities/auth/token-storage';
import { clearErrorHistory } from '@/api/error-notification';
import type { User } from '@/types/models';
import authApi from '@/services/api/auth/auth';
import { runRequest } from '@/stores/helpers';
import type { SliceCreator } from '@/stores/helpers';

export interface AuthState {
    user: User | null;
    isLoading: boolean;
    error: string | null;

    passwordInfo?: {
        lastChanged?: Date;
        requiresChange?: boolean;
    };

    isChangingPassword: boolean;
    isLoadingPasswordInfo: boolean;
}

export interface AuthActions {
    initializeAuth: () => Promise<{ user: User | null }>;
    signIn: (credentials: { email: string; password: string }) => Promise<{ user: User | null }>;
    signUp: (details: { name: string; email: string; password: string }) => Promise<{ user: User | null }>;
    signOut: () => void;
    clearError: () => void;
    changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<{}>;
    getPasswordInfo: () => Promise<{ passwordInfo?: AuthState['passwordInfo'] }>;
}

export type AuthSlice = AuthState & AuthActions;

export const initialState: AuthState = {
    user: null,
    isLoading: false,
    error: null,

    passwordInfo: undefined,
    isChangingPassword: false,
    isLoadingPasswordInfo: false
};

export const createAuthSlice: SliceCreator<AuthSlice> = (set, get) => {
    const handleAuthSuccess = (response: { user: User; token: string }) => {
        TokenStorage.setToken(response.token);

        set({
            user: response.user,
            error: null
        });

        return { user: response.user };
    };

    return {
        ...initialState,

        initializeAuth: async () => {
            const token = TokenStorage.getToken();

            if (!token) {
                set({ user: null });
                return { user: null };
            }

            const user = await runRequest(set, get, () => authApi.getMe(), {
                loadingKey: 'isLoading',
                onSuccess: (user) => {
                    set({ user, error: null });
                },
                onError: () => {
                    TokenStorage.removeToken();
                    set({ user: null });
                }
            });

            return { user };
        },

        signIn: async (credentials) => {
            const result = await runRequest(set, get, () => authApi.signIn(credentials), {
                loadingKey: 'isLoading',
                errorFallback: 'Failed to sign in',
                rethrow: true,
                onSuccess: handleAuthSuccess
            });

            return result ? { user: result.user } : { user: null };
        },

        signUp: async (details) => {
            const result = await runRequest(set, get, () => authApi.signUp(details), {
                loadingKey: 'isLoading',
                errorFallback: 'Failed to sign up',
                rethrow: true,
                onSuccess: handleAuthSuccess
            });

            return result ? { user: result.user } : { user: null };
        },

        signOut: () => {
            TokenStorage.removeToken();
            clearErrorHistory();

            set({
                user: null,
                error: null
            });

            window.location.href = '/auth/sign-in';
        },

        clearError: () => {
            set({ error: null });
        },

        changePassword: async ({ currentPassword, newPassword }) => {
            await runRequest(
                set,
                get,
                () =>
                    authApi.password.change({
                        currentPassword,
                        newPassword
                    }),
                {
                    loadingKey: 'isChangingPassword',
                    rethrow: true
                }
            );

            return {};
        },

        getPasswordInfo: async () => {
            const passwordInfo = await runRequest(set, get, () => authApi.password.getInfo(), {
                loadingKey: 'isLoadingPasswordInfo',
                rethrow: true,
                onSuccess: (passwordInfo) => {
                    set({ passwordInfo });
                }
            });

            return { passwordInfo };
        }
    };
};
