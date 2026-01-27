import type { User } from '../../domain/entities';
import { runRequest } from '@/shared/presentation/stores/helpers';
import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import { getAuthUseCases } from '../../application/registry';

import type { AuthUseCases } from '../../application/registry';

export interface AuthState {
    user: User | null;
    isLoading: boolean;
    error: string | null;

    passwordInfo?: {
        hasPassword?: boolean;
        lastChanged?: string;
    };

    isChangingPassword: boolean;
    isLoadingPasswordInfo: boolean;
}

export interface AuthActions {
    initializeAuth: () => Promise<{ user: User | null }>;
    signIn: (credentials: { email: string; password: string }) => Promise<{ user: User | null }>;
    signUp: (details: { email: string; password: string; firstName: string; lastName: string }) => Promise<{ user: User | null }>;
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

const resolveUseCases = (): AuthUseCases => getAuthUseCases();

export const createAuthSlice: SliceCreator<AuthSlice> = (set, get) => {
    const handleAuthSuccess = (response: { user: User; token: string }) => {
        set({
            user: response.user,
            error: null
        });

        return { user: response.user };
    };

    return {
        ...initialState,

        initializeAuth: async () => {
            const { getMeUseCase } = resolveUseCases();

            const user = await runRequest(set, get, () => getMeUseCase.execute(), {
                loadingKey: 'isLoading',
                onSuccess: (user) => {
                    set({ user, error: null });
                },
                onError: () => {
                    set({ user: null });
                }
            });

            return { user };
        },

        signIn: async (credentials) => {
            const { signInUseCase } = resolveUseCases();
            const result = await runRequest(set, get, () => signInUseCase.execute(credentials), {
                loadingKey: 'isLoading',
                errorFallback: 'Failed to sign in',
                rethrow: true,
                successMessage: 'Signed in successfully',
                onSuccess: handleAuthSuccess
            });

            return result ? { user: result.user } : { user: null };
        },

        signUp: async (details) => {
            const { signUpUseCase } = resolveUseCases();
            const result = await runRequest(set, get, () => signUpUseCase.execute(details), {
                loadingKey: 'isLoading',
                errorFallback: 'Failed to sign up',
                rethrow: true,
                successMessage: 'Signed up successfully',
                onSuccess: handleAuthSuccess
            });

            return result ? { user: result.user } : { user: null };
        },

        signOut: () => {
            const { signOutUseCase } = resolveUseCases();
            signOutUseCase.execute();

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
            const { changePasswordUseCase } = resolveUseCases();
            await runRequest(
                set,
                get,
                () =>
                    changePasswordUseCase.execute({
                        currentPassword,
                        newPassword
                    }),
                {
                    loadingKey: 'isChangingPassword',
                    rethrow: true,
                    successMessage: 'Password changed successfully'
                }
            );

            return {};
        },

        getPasswordInfo: async () => {
            const { getPasswordInfoUseCase } = resolveUseCases();
            const passwordInfo = await runRequest(set, get, () => getPasswordInfoUseCase.execute(), {
                loadingKey: 'isLoadingPasswordInfo',
                rethrow: true,
                onSuccess: (passwordInfo) => {
                    set({ passwordInfo });
                }
            });

            return { passwordInfo: passwordInfo ?? undefined };
        }
    };
};
