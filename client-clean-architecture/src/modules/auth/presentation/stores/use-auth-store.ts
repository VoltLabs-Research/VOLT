import { create } from 'zustand';
import { container } from 'tsyringe';
import type { User } from '@/modules/auth/domain/entities';
import type GetMeUseCase from '@/modules/auth/application/use-cases/GetMeUseCase';
import type ITokenStorage from '@/modules/auth/domain/ports/ITokenStorage';
import type GetAllTeamsUseCase from '@/modules/team/application/use-cases/team/GetAllTeamsUseCase';
import type ITeamStorage from '@/modules/team/domain/ports/ITeamStorage';
import { AUTH_TOKENS } from '@/modules/auth/infrastructure/di/tokens';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';

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
            const getMeUseCase = container.resolve<GetMeUseCase>(AUTH_TOKENS.GetMeUseCase);
            const user = await getMeUseCase.execute();
            set({ user, isInitialized: true, isLoading: false });

            // Fetch teams and auto-select one
            const getAllTeamsUseCase = container.resolve<GetAllTeamsUseCase>(TEAM_TOKENS.GetAllTeamsUseCase);
            const teams = await getAllTeamsUseCase.execute();
            
            const teamStore = useTeamStore.getState();
            teamStore.setTeams(teams);

            if(teams.length > 0){
                const teamStorage = container.resolve<ITeamStorage>(TEAM_TOKENS.TeamStorage);
                const storedTeamId = teamStorage.getSelectedTeamId();
                const storedTeam = teams.find((t) => t._id === storedTeamId);
                const selectedTeam = storedTeam ?? teams[0];
                teamStore.setSelectedTeam(selectedTeam);
            }
        }catch(error){
            console.error('Failed to initialize auth:', error);
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
