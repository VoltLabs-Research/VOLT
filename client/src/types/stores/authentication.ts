import type { User } from '@/types/models';

export interface AuthState {
    user: User | null;
    isLoading: boolean;
    error: string | null;
}

export interface AuthActions{
    initializeAuth: () => Promise<void | { user: null }>;
    signIn: (credentials: Record<string, string>) => Promise<void>;
    signUp: (details: Record<string, string>) => Promise<void>;
    signOut: () => void;
    clearError: () => void;
}

export type AuthStore = AuthState & AuthActions;