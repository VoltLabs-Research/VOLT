import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import useClusterMetrics from '@/modules/cluster/hooks/use-cluster-metrics';
import { resolveClusterMetricId } from '@/modules/cluster/utilities/resolve-cluster-metric-id';
import { useMemo, useState } from 'react';
import type { DeleteTeamClusterOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/delete-team-cluster';
import type { TeamCluster, TeamClusterCredentialServices } from '@/modules/cluster/api/entities/team-cluster';
import type { ClusterMetrics } from '@/modules/cluster/api/entities/cluster-metrics';

export interface ClustersPageViewModel {
    clusters: TeamCluster[];
    selectedCluster: TeamCluster | null;
    selectedClusterId: string;
    setSelectedClusterId: (clusterId: string) => void;
    metrics: ClusterMetrics | null;
    history: ClusterMetrics[];
    metricsByClusterId: Record<string, ClusterMetrics>;
    revealCredentials: (password: string) => Promise<void>;
    deleteCluster: (password: string) => Promise<DeleteTeamClusterOutputDTO>;
    credentials: TeamClusterCredentialServices | null;
    credentialsCluster: TeamCluster | null;
    deleteTarget: TeamCluster | null;
    setCredentialsCluster: (teamCluster: TeamCluster | null) => void;
    setDeleteTarget: (teamCluster: TeamCluster | null) => void;
    isLoading: boolean;
};

const useClustersPage = (): ClustersPageViewModel => {
    const management = useClusterManagement();
    const metricsState = useClusterMetrics();

    const [credentials, setCredentials] = useState<TeamClusterCredentialServices | null>(null);
    const [credentialsCluster, setCredentialsCluster] = useState<TeamCluster | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<TeamCluster | null>(null);

    const metricsByClusterId = useMemo<Record<string, ClusterMetrics>>(() => {
        return metricsState.clusters.reduce<Record<string, ClusterMetrics>>((acc, cluster) => {
            const clusterId = resolveClusterMetricId(cluster);
            acc[clusterId] = cluster;
            return acc;
        }, {});
    }, [metricsState.clusters]);

    const selectedMetrics = useMemo(() => {
        if (!management.selectedCluster) {
            return null;
        }

        return metricsByClusterId[management.selectedCluster._id] ?? null;
    }, [management.selectedCluster, metricsByClusterId]);

    const revealCredentials = async (password: string) => {
        if (!credentialsCluster) {
            return;
        }

        const nextCredentials = await management.revealCredentials(credentialsCluster._id, password);
        setCredentials(nextCredentials);
    };

    const deleteCluster = async (password: string) => {
        if (!deleteTarget) {
            throw new Error('Missing cluster delete target');
        }

        return management.deleteCluster(deleteTarget._id, password);
    };

    return {
        clusters: management.clusters,
        selectedCluster: management.selectedCluster,
        selectedClusterId: management.selectedClusterId,
        setSelectedClusterId: management.setSelectedClusterId,
        metrics: selectedMetrics,
        history: metricsState.history,
        metricsByClusterId,
        revealCredentials,
        deleteCluster,
        credentials,
        credentialsCluster,
        deleteTarget,
        setCredentialsCluster: (teamCluster) => {
            setCredentials(null);
            setCredentialsCluster(teamCluster);
        },
        setDeleteTarget,
        isLoading: management.isLoading
    };
};

export default useClustersPage;
