import { create } from 'zustand';
import { container } from 'tsyringe';
import type { User } from '@/modules/auth/domain/entities';
import type IAuthRepository from '@/modules/auth/domain/port/IAuthRepository';
import type ITokenStorage from '@/modules/auth/domain/port/ITokenStorage';
import { AUTH_TOKENS } from '@/modules/auth/infrastructure/di/tokens';

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
            set({ user: null, isInitialized: true, isLoading: false });
        }
    },

    setUser: (user) => {
        set({ user });
    },

    signOut: () => {
        const tokenStorage = container.resolve<ITokenStorage>(AUTH_TOKENS.TokenStorage);
        tokenStorage.removeToken();
        set({ user: null });
        window.location.href = '/auth/sign-in';
    },

    clearAuth: () => {
        set({ user: null, isInitialized: false });
    }
}));
