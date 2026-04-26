import { clearCurrentUserQueryData, fetchCurrentUser } from '@/modules/auth/hooks/queries';
import { clearSocketSession, updateSocketAuthToken } from '@/modules/socket/services/socket-auth-session';
import { resetTeamSessionState } from '@/modules/team/stores/team/use-team-store';
import { tokenStorage } from '@/shared/auth/token-storage';
import { create } from 'zustand';

interface AuthState{
    isLoading: boolean;
    isInitialized: boolean;
    hasToken: boolean;
};

interface AuthActions{
    initializeAuth: () => Promise<void>;
    markAuthenticated: (token: string | null) => void;
    signOut: () => void;
};

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
    isLoading: false,
    isInitialized: false,
    hasToken: false,

    initializeAuth: async () => {
        const token = tokenStorage.getToken();
        updateSocketAuthToken(token);

        if(!token){
            resetTeamSessionState();
            clearSocketSession();
            await clearCurrentUserQueryData();
            set({
                isInitialized: true,
                isLoading: false,
                hasToken: false
            });
            return;
        }

        set({ isLoading: true, hasToken: true });

        try{
            await fetchCurrentUser();
            set({ isInitialized: true, isLoading: false, hasToken: true });
        }catch{
            tokenStorage.removeToken();
            clearSocketSession();
            resetTeamSessionState();
            await clearCurrentUserQueryData();
            set({
                isInitialized: true,
                isLoading: false,
                hasToken: false
            });
        }
    },

    markAuthenticated: (token) => {
        if (token) {
            tokenStorage.setToken(token);
        } else {
            tokenStorage.removeToken();
        }

        updateSocketAuthToken(token);

        set({
            isInitialized: true,
            isLoading: false,
            hasToken: Boolean(token)
        });
    },

    signOut: () => {
        tokenStorage.removeToken();
        clearSocketSession();
        resetTeamSessionState();
        clearCurrentUserQueryData().catch(() => undefined);
        set({
            isInitialized: false,
            isLoading: false,
            hasToken: false
        });
        window.location.href = '/auth/sign-in';
    }
}));
