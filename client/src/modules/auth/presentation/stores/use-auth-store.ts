import { create } from 'zustand';
import { container } from 'tsyringe';
import type { User } from '@/modules/auth/domain/entities';
import type IAuthRepository from '@/modules/auth/domain/port/IAuthRepository';
import type ITokenStorage from '@/modules/auth/domain/port/ITokenStorage';
import { AUTH_TOKENS } from '@/modules/auth/infrastructure/di/tokens';
import { resetTeamSessionState } from '@/modules/team/presentation/stores/use-team-store';

interface AuthState{
    user: User | null;
    isLoading: boolean;
    isInitialized: boolean;
}

interface AuthActions{
    initializeAuth: () => Promise<void>;
    setUser: (user: User | null) => void;
    signOut: () => void;
    clearAuth: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
    user: null,
    isLoading: false,
    isInitialized: false,

    initializeAuth: async () => {
        const tokenStorage = container.resolve<ITokenStorage>(AUTH_TOKENS.TokenStorage);
        const token = tokenStorage.getToken();

        if(!token){
            resetTeamSessionState();
            set({ user: null, isInitialized: true, isLoading: false });
            return;
        }

        set({ isLoading: true });

        try{
            const authRepository = container.resolve<IAuthRepository>(AUTH_TOKENS.AuthRepository);
            const user = await authRepository.getMe();
            set({ user, isInitialized: true, isLoading: false });
        }catch{
            tokenStorage.removeToken();
            resetTeamSessionState();
            set({ user: null, isInitialized: true, isLoading: false });
        }
    },

    setUser: (user) => {
        set({ user });
    },

    signOut: () => {
        const tokenStorage = container.resolve<ITokenStorage>(AUTH_TOKENS.TokenStorage);
        tokenStorage.removeToken();
        resetTeamSessionState();
        set({ user: null, isInitialized: false, isLoading: false });
        window.location.href = '/auth/sign-in';
    },

    clearAuth: () => {
        set({ user: null, isInitialized: false, isLoading: false });
    }
}));
