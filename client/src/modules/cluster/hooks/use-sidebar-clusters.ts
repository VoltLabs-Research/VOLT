import {
    useTeamClustersQuery,
    useRevealTeamClusterCredentialsMutation
} from '@/modules/cluster/hooks/team-cluster/queries';
import { CLUSTER_CREDENTIALS_MODAL_ID } from '@/modules/cluster/components/ClusterCredentialsModal';
import { openModal } from '@/shared/ui/modal';
import { showPromise } from '@/shared/ui/hooks/toast';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { TeamCluster, TeamClusterCredentialServices } from '@volt/contracts/modules/cluster/domain';

const useSidebarClusters = (setSidebarOpen: (open: boolean) => void) => {
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

    const handleRevealCredentials = useCallback((cluster: TeamCluster) => {
        if (isOnClustersRoute) {
            navigateToCluster(cluster);
            return;
        }

        setCredentials(null);
        setCredentialsCluster(cluster);
        openModal(CLUSTER_CREDENTIALS_MODAL_ID);
    }, [isOnClustersRoute, navigateToCluster]);

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
        handleMonitor: navigateToCluster,
        handleRevealCredentials,
        revealCredentials,
        setCredentialsCluster: (cluster: TeamCluster | null) => {
            setCredentials(null);
            setCredentialsCluster(cluster);
        }
    };
};

export default useSidebarClusters;
