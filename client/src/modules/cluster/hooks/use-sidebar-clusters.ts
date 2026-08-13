import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { TeamCluster } from '@volt/contracts/modules/cluster/domain';

const useSidebarClusters = (setSidebarOpen: (open: boolean) => void) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const selectedTeamId = useSelectedTeamId();

    const isOnClustersRoute = pathname.startsWith('/dashboard/clusters');

    const { data } = useTeamClustersQuery(selectedTeamId ?? '');
    const clusters = data?.data ?? [];



    const navigateToCluster = useCallback((cluster: TeamCluster) => {
        navigate(`/dashboard/clusters/${cluster._id}`);
        setSidebarOpen(false);
    }, [navigate, setSidebarOpen]);

    return {
        clusters,
        selectedTeamId,
        isOnClustersRoute,
        handleMonitor: navigateToCluster
    };
};

export default useSidebarClusters;
