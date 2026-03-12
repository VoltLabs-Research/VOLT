import {
    invalidateAvailableVersionsQuery,
    useTeamClustersQuery,
    useRevealTeamClusterCredentialsMutation,
    useRequestClusterUpdateMutation
} from '@/modules/cluster/hooks/team-cluster/queries';
import { CLUSTER_CREDENTIALS_MODAL_ID } from '@/modules/cluster/components/organisms/ClusterCredentialsModal';
import { UPDATE_CLUSTER_MODAL_ID } from '@/modules/cluster/components/organisms/UpdateClusterModal';
import { openModal } from '@/shared/presentation/components/Modal';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { TeamCluster, TeamClusterCredentialServices } from '@/modules/cluster/api/entities/team-cluster';
import type { RequestClusterUpdateOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/request-cluster-update';

interface SidebarClustersResult {
    clusters: TeamCluster[];
    selectedTeamId: string | null;
    isOnClustersRoute: boolean;
    credentialsCluster: TeamCluster | null;
    credentials: TeamClusterCredentialServices | null;
    updateTarget: TeamCluster | null;
    handleMonitor: (cluster: TeamCluster) => void;
    handleRevealCredentials: (cluster: TeamCluster) => void;
    handleUpdateCluster: (cluster: TeamCluster) => void;
    handleOpenTerminal: (cluster: TeamCluster) => void;
    handleExploreMongo: (cluster: TeamCluster) => void;
    handleExploreRedis: (cluster: TeamCluster) => void;
    handleExploreMinio: (cluster: TeamCluster) => void;
    revealCredentials: (password: string) => Promise<void>;
    requestUpdate: (targetVersion: string, isEdge: boolean, password: string) => Promise<RequestClusterUpdateOutputDTO>;
    setCredentialsCluster: (cluster: TeamCluster | null) => void;
    setUpdateTarget: (cluster: TeamCluster | null) => void;
};

/**
 * Lightweight hook for sidebar cluster actions. Fetches the team's clusters
 * and manages modal state for credential reveal and update flows.
 *
 * Remote access actions (terminal, mongo, redis, minio) navigate to dedicated
 * pages instead of opening modals.
 */
const useSidebarClusters = (setSidebarOpen: (open: boolean) => void): SidebarClustersResult => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const selectedTeamId = useSelectedTeamId();

    const isOnClustersRoute = pathname.startsWith('/dashboard/clusters');

    const { data } = useTeamClustersQuery(selectedTeamId ?? '');
    const clusters = data?.data ?? [];

    const [credentials, setCredentials] = useState<TeamClusterCredentialServices | null>(null);
    const [credentialsCluster, setCredentialsCluster] = useState<TeamCluster | null>(null);
    const [updateTarget, setUpdateTarget] = useState<TeamCluster | null>(null);

    const revealCredentialsMutation = useRevealTeamClusterCredentialsMutation();
    const updateMutation = useRequestClusterUpdateMutation();

    const navigateToCluster = useCallback((cluster: TeamCluster) => {
        navigate(`/dashboard/clusters/${cluster._id}`);
        setSidebarOpen(false);
    }, [navigate, setSidebarOpen]);

    const handleMonitor = useCallback((cluster: TeamCluster) => {
        navigateToCluster(cluster);
    }, [navigateToCluster]);

    const handleRevealCredentials = useCallback((cluster: TeamCluster) => {
        if (isOnClustersRoute) {
            navigateToCluster(cluster);
            return;
        }

        setCredentials(null);
        setCredentialsCluster(cluster);
        openModal(CLUSTER_CREDENTIALS_MODAL_ID);
    }, [isOnClustersRoute, navigateToCluster]);

    const handleUpdateCluster = useCallback((cluster: TeamCluster) => {
        if (isOnClustersRoute) {
            navigateToCluster(cluster);
            return;
        }

        setUpdateTarget(cluster);
        if (selectedTeamId) {
            invalidateAvailableVersionsQuery(selectedTeamId, cluster._id);
        }
        openModal(UPDATE_CLUSTER_MODAL_ID);
    }, [isOnClustersRoute, navigateToCluster, selectedTeamId]);

    const handleOpenTerminal = useCallback((cluster: TeamCluster) => {
        navigate(`/dashboard/clusters/${cluster._id}/terminal`);
        setSidebarOpen(false);
    }, [navigate, setSidebarOpen]);

    const handleExploreMongo = useCallback((cluster: TeamCluster) => {
        navigate(`/dashboard/clusters/${cluster._id}/mongo`);
        setSidebarOpen(false);
    }, [navigate, setSidebarOpen]);

    const handleExploreRedis = useCallback((cluster: TeamCluster) => {
        navigate(`/dashboard/clusters/${cluster._id}/redis`);
        setSidebarOpen(false);
    }, [navigate, setSidebarOpen]);

    const handleExploreMinio = useCallback((cluster: TeamCluster) => {
        navigate(`/dashboard/clusters/${cluster._id}/minio`);
        setSidebarOpen(false);
    }, [navigate, setSidebarOpen]);

    const revealCredentials = useCallback(async (password: string) => {
        if (!credentialsCluster || !selectedTeamId) {
            return;
        }

        const result = await showPromise(
            revealCredentialsMutation.mutateAsync({
                teamId: selectedTeamId,
                teamClusterId: credentialsCluster._id,
                password
            }),
            {
                loading: { title: 'Revealing credentials...' },
                success: { title: 'Credentials revealed' },
                error: { title: 'Failed to reveal credentials' }
            }
        );

        setCredentials(result.services);
    }, [credentialsCluster, selectedTeamId, revealCredentialsMutation]);

    const requestUpdate = useCallback(async (targetVersion: string, isEdge: boolean, password: string) => {
        if (!updateTarget || !selectedTeamId) {
            throw new Error('Missing cluster update target');
        }

        return showPromise(
            updateMutation.mutateAsync({
                teamId: selectedTeamId,
                teamClusterId: updateTarget._id,
                targetVersion,
                isEdge,
                password
            }),
            {
                loading: { title: 'Requesting cluster update...' },
                success: { title: 'Update requested' },
                error: { title: 'Failed to request cluster update' }
            }
        );
    }, [updateTarget, selectedTeamId, updateMutation]);

    return {
        clusters,
        selectedTeamId,
        isOnClustersRoute,
        credentialsCluster,
        credentials,
        updateTarget,
        handleMonitor,
        handleRevealCredentials,
        handleUpdateCluster,
        handleOpenTerminal,
        handleExploreMongo,
        handleExploreRedis,
        handleExploreMinio,
        revealCredentials,
        requestUpdate,
        setCredentialsCluster: (cluster: TeamCluster | null) => {
            setCredentials(null);
            setCredentialsCluster(cluster);
        },
        setUpdateTarget
    };
};

export default useSidebarClusters;
