import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { useClusterStore } from '@/modules/cluster/stores/use-cluster-store';
import { useTeamsQuery } from '@/modules/team/hooks/team/queries';
import { useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { isElectronEnvironment } from '@/shared/utils/electron-environment';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@/modules/auth/api/entities/user';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type { Team } from '@/modules/team/api/entities/team/team';
import type { DesktopWindowState } from '@/shared/utils/electron-contract';

const DEFAULT_WINDOW_STATE: DesktopWindowState = {
    isFullScreen: false,
    isMaximized: false
};

const resolveIdentityUserLabel = (user: User | null): string => {
    if (!user) {
        return 'user';
    }

    const firstName = user.firstName?.trim() ?? '';
    const lastName = user.lastName?.trim() ?? '';

    if (firstName && lastName) {
        return `${firstName}.${lastName}`;
    }

    const username = user.username?.trim();

    if (username) {
        return username;
    }

    const emailLocalPart = user.email.split('@')[0]?.trim();

    if (emailLocalPart) {
        return emailLocalPart;
    }

    return 'user';
};

const resolveSelectedTeam = (teams: Team[] | undefined, selectedTeamId: string | null): Team | null => {
    if (!teams?.length) {
        return null;
    }

    if (!selectedTeamId) {
        return teams[0] ?? null;
    }

    return teams.find((team) => team._id === selectedTeamId) ?? teams[0] ?? null;
};

const resolveSelectedCluster = (
    clusters: TeamCluster[] | undefined,
    selectedClusterId: string
): TeamCluster | null => {
    if (!clusters?.length) {
        return null;
    }

    return clusters.find((cluster) => cluster._id === selectedClusterId) ?? clusters[0] ?? null;
};

/** Provides window control handlers and the derived identity label for the desktop titlebar. */
export const useDesktopTitlebar = () => {
    const user = useCurrentUser();
    const isLoading = useAuthStore((state) => state.isLoading);
    const isInitialized = useAuthStore((state) => state.isInitialized);
    const hasToken = useAuthStore((state) => state.hasToken);
    const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
    const selectedClusterId = useClusterStore((state) => state.selectedClusterId);
    const [windowState, setWindowState] = useState<DesktopWindowState>(DEFAULT_WINDOW_STATE);
    const isDesktop = isElectronEnvironment();
    const shouldResolveIdentity = isInitialized && hasToken && !isLoading;
    const teamsQuery = useTeamsQuery(undefined, {
        enabled: shouldResolveIdentity
    });
    const effectiveTeamId = selectedTeamId ?? teamsQuery.data?.[0]?._id ?? '';
    const teamClustersQuery = useTeamClustersQuery(effectiveTeamId, {
        enabled: shouldResolveIdentity && Boolean(effectiveTeamId)
    });

    useEffect(() => {
        if (!isDesktop || !window.voltDesktop) {
            return;
        }

        let isMounted = true;

        const syncWindowState = async () => {
            const nextState = await window.voltDesktop?.windowControls.getState();

            if (isMounted && nextState) {
                setWindowState(nextState);
            }
        };

        syncWindowState();
        const unsubscribe = window.voltDesktop.windowControls.onStateChange(setWindowState);

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [isDesktop]);

    const selectedTeam = useMemo(() => {
        return resolveSelectedTeam(teamsQuery.data, selectedTeamId);
    }, [selectedTeamId, teamsQuery.data]);

    const selectedCluster = useMemo(() => {
        return resolveSelectedCluster(teamClustersQuery.data?.data, selectedClusterId);
    }, [selectedClusterId, teamClustersQuery.data?.data]);

    const identityLabel = useMemo(() => {
        if (!shouldResolveIdentity) {
            return 'authentication required';
        }

        const userLabel = resolveIdentityUserLabel(user);
        const teamName = selectedTeam?.name.trim() || 'unknown-team';
        const clusterName = selectedCluster?.name.trim() || 'unknown-cluster';

        return `${userLabel}@${teamName}:/${clusterName}`;
    }, [selectedCluster, selectedTeam, shouldResolveIdentity, user]);

    const handleMinimize = useCallback(() => {
        window.voltDesktop?.windowControls.minimize();
    }, []);

    const handleToggleMaximize = useCallback(() => {
        window.voltDesktop?.windowControls.toggleMaximize();
    }, []);

    const handleClose = useCallback(() => {
        window.voltDesktop?.windowControls.close();
    }, []);

    return {
        handleClose,
        handleMinimize,
        handleToggleMaximize,
        identityLabel,
        isDesktop,
        isMaximized: windowState.isMaximized
    };
};
