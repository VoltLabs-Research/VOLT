import { TEAM_INVITATION_QUERY_KEYS } from '@/modules/team/hooks/invitation/queries';
import { TEAM_MEMBER_QUERY_KEYS } from '@/modules/team/hooks/member/queries';
import { TEAM_QUERY_KEYS } from '@/modules/team/hooks/team/queries';
import { TEAM_ROLE_QUERY_KEYS } from '@/modules/team/hooks/role/queries';
import teamStorage from '@/modules/team/services/team/team-storage';
import { useTeamPresenceStore } from '@/modules/team/stores/team/use-team-presence-store';
import { resetTeamScopedStores } from '@/shared/utils/application-store-cleanups';
import queryClient from '@/shared/infrastructure/query/query-client';
import { getPreservedQueryPrefixes, runManualAppCleanup } from '@/shared/utils/app-cleanup-registry';
import { create } from 'zustand';

interface TeamStore {
    selectedTeamId: string | null;
    hasHydratedSelection: boolean;
    hydrateSelectedTeamId: () => void;
    setSelectedTeamId: (teamId: string | null) => void;
    reset: () => void;
};

const initialState = {
    selectedTeamId: null,
    hasHydratedSelection: false
};

export const useTeamStore = create<TeamStore>((set) => ({
    ...initialState,

    hydrateSelectedTeamId: () => {
        const storedTeamId = teamStorage.getSelectedTeamId();

        set((state) => {
            if (state.hasHydratedSelection) {
                return state;
            }

            return {
                selectedTeamId: storedTeamId,
                hasHydratedSelection: true
            };
        });
    },

    setSelectedTeamId: (teamId) => {
        if (teamId) {
            teamStorage.setSelectedTeamId(teamId);
        } else {
            teamStorage.clearSelectedTeamId();
        }

        set({ selectedTeamId: teamId, hasHydratedSelection: true });
    },

    reset: () => set(initialState)
}));

export const resetTeamDependentStores = (): void => {
    queryClient.removeQueries({ queryKey: TEAM_QUERY_KEYS.permissions() });
    queryClient.removeQueries({ queryKey: TEAM_MEMBER_QUERY_KEYS.members() });
    queryClient.removeQueries({ queryKey: TEAM_ROLE_QUERY_KEYS.roles() });
    queryClient.removeQueries({ queryKey: TEAM_INVITATION_QUERY_KEYS.invitations() });
    useTeamPresenceStore.getState().reset();
};

/**
 * Returns true for query keys whose prefix was registered via
 * {@link registerPreservedQueryKey}. These queries survive a team switch
 * because their data is fed by WebSocket subscriptions, not REST refetches.
 */
const isPreservedQuery = (queryKey: readonly unknown[]): boolean => {
    const first = queryKey[0];
    if (typeof first !== 'string') return false;
    return getPreservedQueryPrefixes().includes(first);
};

/**
 * Resets all team-scoped application state when switching teams.
 * Clears Zustand stores and removes all queries except auth, teams list,
 * and socket-managed caches (cluster metrics, team jobs), so the user
 * stays authenticated and WebSocket-fed components remain functional.
 */
export const resetTeamScopedApplicationState = (): void => {
    // 1. Reset team-scoped Zustand stores (excludes cluster & jobs
    //    whose lifecycle is managed by their WebSocket hooks)
    resetTeamScopedStores();

    // 2. Remove all cached queries except preserved prefixes
    queryClient.removeQueries({
        predicate: (query) => !isPreservedQuery(query.queryKey)
    });

    // 3. Reset team-specific stores and query caches
    resetTeamDependentStores();
};

const getCurrentPathname = (): string | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.location.pathname;
};

export const resetTeamSessionState = (): void => {
    const currentPathname = getCurrentPathname();
    runManualAppCleanup(currentPathname, null);
    const cachedTeams = queryClient.getQueryData<{ _id: string }[]>(TEAM_QUERY_KEYS.teams()) ?? [];
    const teamState = useTeamStore.getState();
    const teamIds = new Set(cachedTeams.map((team) => team._id));

    if (teamState.selectedTeamId) {
        teamIds.add(teamState.selectedTeamId);
    }

    teamStorage.clearSelectedTeamId();
    useTeamStore.getState().reset();
    resetTeamDependentStores();
};
