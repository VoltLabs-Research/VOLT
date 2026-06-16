import { clearCurrentUserQueryData, fetchCurrentUser } from '@/modules/auth/hooks/queries';
import { clearSocketSession, updateSocketAuthToken } from '@/modules/socket/services/socket-auth-session';
import { resetTeamSessionState } from '@/modules/team/stores/team/use-team-store';
import { tokenStorage } from '@/shared/auth/token-storage';
import authService from '@/modules/auth/api/service';
import systemService from '@/modules/system/api/service';
import { create } from 'zustand';

interface AuthState{
    isLoading: boolean;
    isInitialized: boolean;
    hasToken: boolean;
}

interface AuthActions{
    initializeAuth: () => Promise<void>;
    markAuthenticated: (token: string | null) => void;
    signOut: () => void;
}

type AuthStore = AuthState & AuthActions;

/**
 * Single-tenant desktop (DEPLOYMENT_MODE=local) has one canonical user and nobody
 * else to authenticate, so the client should always be signed in. When there is
 * no usable session, ask the server's local-only endpoint to mint one for the
 * local user. Returns the token on success, or null in cloud mode / on failure
 * (callers then fall back to the normal sign-in flow). Best-effort: never throws.
 */
const tryLocalAutoLogin = async (): Promise<string | null> => {
    try{
        const { mode } = await systemService.getDeploymentConfig({});
        if(mode !== 'local'){
            return null;
        }
        const { token } = await authService.localSignIn({});
        return token ?? null;
    }catch{
        return null;
    }
};


export const useAuthStore = create<AuthStore>((set) => ({
    isLoading: false,
    isInitialized: false,
    hasToken: false,

    initializeAuth: async () => {
        let token = tokenStorage.getToken();

        // No stored session: in local mode, mint one automatically so the desktop
        // app is always signed in (covers token expiry / reload / direct browser).
        if(!token){
            const localToken = await tryLocalAutoLogin();
            if(localToken){
                tokenStorage.setToken(localToken);
                token = localToken;
            }
        }

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
            // Stored token is invalid/expired. Try a fresh local session before
            // giving up (so local mode never bounces to the sign-in screen).
            tokenStorage.removeToken();
            const localToken = await tryLocalAutoLogin();
            if(localToken){
                tokenStorage.setToken(localToken);
                updateSocketAuthToken(localToken);
                try{
                    await fetchCurrentUser();
                    set({ isInitialized: true, isLoading: false, hasToken: true });
                    return;
                }catch{
                    tokenStorage.removeToken();
                }
            }

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
