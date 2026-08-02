import { clearCurrentUserQueryData, fetchCurrentUser } from '@/modules/auth/hooks/queries';
import { clearSocketSession, updateSocketAuthToken } from '@/modules/socket/services/socket-auth-session';
import { resetTeamSessionState } from '@/modules/team/store/team/use-team-store';
import { tokenStorage } from '@/shared/auth/token-storage';
import authService from '@/modules/auth/api/service';
import systemService from '@/modules/system/api/service';
import { create } from 'zustand';

interface AuthStore{
    isLoading: boolean;
    isInitialized: boolean;
    hasToken: boolean;
    initializeAuth: () => Promise<void>;
    markAuthenticated: (token: string | null) => void;
    signOut: () => void;
}

const tryLocalAutoLogin = async (): Promise<string | null> => {
    try{
        const { mode } = await systemService.getDeploymentConfig({});
        if(mode !== 'local'){
            return null;
        }
        const { token } = await authService.localSignIn({});
        return token;
    }catch{
        return null;
    }
};

export const useAuthStore = create<AuthStore>((set) => {
    const markSignedIn = () => set({
        isInitialized: true,
        isLoading: false,
        hasToken: true
    });

    const markSignedOut = async () => {
        clearSocketSession();
        resetTeamSessionState();
        await clearCurrentUserQueryData();
        set({
            isInitialized: true,
            isLoading: false,
            hasToken: false
        });
    };

    return {
        isLoading: false,
        isInitialized: false,
        hasToken: false,

        initializeAuth: async () => {
            let token = tokenStorage.getToken();

            if(!token){
                const localToken = await tryLocalAutoLogin();
                if(localToken){
                    tokenStorage.setToken(localToken);
                    token = localToken;
                }
            }

            updateSocketAuthToken(token);

            if(!token){
                await markSignedOut();
                return;
            }

            set({
                isLoading: true,
                hasToken: true
            });

            try{
                await fetchCurrentUser();
                markSignedIn();
            }catch{
                // The stored token was rejected: drop it and retry local auto-login once.
                tokenStorage.removeToken();
                const localToken = await tryLocalAutoLogin();
                if(localToken){
                    tokenStorage.setToken(localToken);
                    updateSocketAuthToken(localToken);
                    try{
                        await fetchCurrentUser();
                        markSignedIn();
                        return;
                    }catch{
                        tokenStorage.removeToken();
                    }
                }

                await markSignedOut();
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
    };
});
