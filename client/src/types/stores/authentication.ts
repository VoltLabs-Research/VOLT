import type { User } from '@/types/models';

export interface AuthState {
    user: User | null;
    isLoading: boolean;
    error: string | null;
    passwordInfo?: {
        lastChanged: string;
        hasPassword: boolean;
    };
    isChangingPassword: boolean;
    isLoadingPasswordInfo: boolean;
}

export interface AuthActions{
    initializeAuth: () => Promise<void | { user: null }>;
    signIn: (credentials: Record<string, string>) => Promise<void>;
    signUp: (details: Record<string, string>) => Promise<void>;
    signOut: () => void;
    clearError: () => void;
    changePassword: (passwordData: { currentPassword: string; newPassword: string; confirmPassword: string }) => Promise<void>;
    getPasswordInfo: () => Promise<void>;
}

export type AuthStore = AuthState & AuthActions;
