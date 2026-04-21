import {
    useTeamClustersQuery,
    useRevealTeamClusterCredentialsMutation
} from '@/modules/cluster/hooks/team-cluster/queries';
import { CLUSTER_CREDENTIALS_MODAL_ID } from '@/modules/cluster/components/ClusterCredentialsModal';
import { openModal } from '@/shared/presentation/components/Modal';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { TeamCluster, TeamClusterCredentialServices } from '@/modules/cluster/api/entities/team-cluster';

interface SidebarClustersResult {
    clusters: TeamCluster[];
    selectedTeamId: string | null;
    isOnClustersRoute: boolean;
    credentialsCluster: TeamCluster | null;
    credentials: TeamClusterCredentialServices | null;
    handleMonitor: (cluster: TeamCluster) => void;
    handleRevealCredentials: (cluster: TeamCluster) => void;
    handleExploreMongo: (cluster: TeamCluster) => void;
    handleExploreRedis: (cluster: TeamCluster) => void;
    handleExploreMinio: (cluster: TeamCluster) => void;
    revealCredentials: (password: string) => Promise<void>;
    setCredentialsCluster: (cluster: TeamCluster | null) => void;
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

    const revealCredentialsMutation = useRevealTeamClusterCredentialsMutation();

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

    return {
        clusters,
        selectedTeamId,
        isOnClustersRoute,
        credentialsCluster,
        credentials,
        handleMonitor,
        handleRevealCredentials,
        handleExploreMongo,
        handleExploreRedis,
        handleExploreMinio,
        revealCredentials,
        setCredentialsCluster: (cluster: TeamCluster | null) => {
            setCredentials(null);
            setCredentialsCluster(cluster);
        }
    };
};

export default useSidebarClusters;
