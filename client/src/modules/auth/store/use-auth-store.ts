import { clearCurrentUserQueryData, fetchCurrentUser } from '@/modules/auth/hooks/queries';
import { clearSocketSession, updateSocketAuthToken } from '@/modules/socket/services/socket-auth-session';
import { resetTeamSessionState } from '@/modules/team/store/team/use-team-store';
import { tokenStorage } from '@/shared/auth/token-storage';
import { tryLocalAutoLogin } from '@/modules/auth/services/local-auto-login';
import { create } from 'zustand';

interface AuthStore{
    isLoading: boolean;
    isInitialized: boolean;
    hasToken: boolean;
    initializeAuth: () => Promise<void>;
    markAuthenticated: (token: string | null) => void;
    signOut: () => void;
}

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
