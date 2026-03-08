import { create } from 'zustand';
import { resetTeamSessionState } from '@/modules/team/stores/use-team-store';
import { clearCurrentUserQueryData, fetchCurrentUser } from '@/modules/auth/hooks/queries';
import TokenStorage from '@/modules/auth/services/token-storage';
import { clearSocketSession, updateSocketAuthToken } from '@/modules/socket/hooks/use-auth';

const tokenStorage = new TokenStorage();

interface AuthState{
    isLoading: boolean;
    isInitialized: boolean;
    hasToken: boolean;
}

interface AuthActions{
    initializeAuth: () => Promise<void>;
    markAuthenticated: (token?: string | null) => void;
    signOut: () => void;
}

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
            set({ isInitialized: true, isLoading: false, hasToken: false });
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
            set({ isInitialized: true, isLoading: false, hasToken: false });
        }
    },

    markAuthenticated: (token) => {
        if (token !== undefined) {
            if (token) {
                tokenStorage.setToken(token);
            } else {
                tokenStorage.removeToken();
            }

            updateSocketAuthToken(token);
        }

        set({
            isInitialized: true,
            isLoading: false,
            hasToken: token !== undefined ? !!token : true
        });
    },

    signOut: () => {
        tokenStorage.removeToken();
        clearSocketSession();
        resetTeamSessionState();
        void clearCurrentUserQueryData();
        set({ isInitialized: false, isLoading: false, hasToken: false });
        window.location.href = '/auth/sign-in';
    }
}));
