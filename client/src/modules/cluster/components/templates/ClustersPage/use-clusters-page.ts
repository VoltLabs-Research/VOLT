import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import useClusterMetrics from '@/modules/cluster/hooks/use-cluster-metrics';
import { resolveClusterMetricId } from '@/modules/cluster/utilities/resolve-cluster-metric-id';
import { useMemo, useState } from 'react';
import type { DeleteTeamClusterOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/delete-team-cluster';
import type { TeamCluster, TeamClusterCredentialServices } from '@/modules/cluster/api/entities/team-cluster';
import type { ClusterMetrics } from '@/modules/cluster/api/entities/cluster-metrics';
import type {
    TeamClusterRemoteAccessSession,
    TeamClusterRemoteAccessTarget,
    TeamClusterRemoteExplorerEntry,
    TeamClusterRemoteExplorerNode
} from '@/modules/cluster/api/entities/team-cluster-remote-access';

interface RemoteAccessRequestState {
    teamCluster: TeamCluster;
    target: TeamClusterRemoteAccessTarget;
};

interface RemoteTerminalState {
    teamCluster: TeamCluster;
    session: TeamClusterRemoteAccessSession;
};

interface RemoteExplorerState extends RemoteTerminalState {
    target: TeamClusterRemoteAccessTarget;
};

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
    remoteAccessRequest: RemoteAccessRequestState | null;
    remoteTerminal: RemoteTerminalState | null;
    remoteExplorer: RemoteExplorerState | null;
    setRemoteAccessRequest: (state: RemoteAccessRequestState | null) => void;
    submitRemoteAccessRequest: (password: string) => Promise<TeamClusterRemoteAccessTarget>;
    closeRemoteTerminal: () => void;
    closeRemoteExplorer: () => void;
    listRemoteExplorerEntries: (
        teamClusterId: string,
        sessionId: string,
        target: TeamClusterRemoteAccessTarget,
        path: string
    ) => Promise<TeamClusterRemoteExplorerEntry[]>;
    getRemoteExplorerNode: (
        teamClusterId: string,
        sessionId: string,
        target: TeamClusterRemoteAccessTarget,
        path: string
    ) => Promise<TeamClusterRemoteExplorerNode>;
    isLoading: boolean;
};

const useClustersPage = (): ClustersPageViewModel => {
    const management = useClusterManagement();
    const metricsState = useClusterMetrics();

    const [credentials, setCredentials] = useState<TeamClusterCredentialServices | null>(null);
    const [credentialsCluster, setCredentialsCluster] = useState<TeamCluster | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<TeamCluster | null>(null);
    const [remoteAccessRequest, setRemoteAccessRequest] = useState<RemoteAccessRequestState | null>(null);
    const [remoteTerminal, setRemoteTerminal] = useState<RemoteTerminalState | null>(null);
    const [remoteExplorer, setRemoteExplorer] = useState<RemoteExplorerState | null>(null);

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

    const submitRemoteAccessRequest = async (password: string) => {
        if (!remoteAccessRequest) {
            throw new Error('Missing remote access request');
        }

        const session = await management.createRemoteAccessSession(
            remoteAccessRequest.teamCluster._id,
            password,
            remoteAccessRequest.target
        );

        if (remoteAccessRequest.target === 'host-terminal') {
            setRemoteTerminal({
                teamCluster: remoteAccessRequest.teamCluster,
                session
            });
            setRemoteExplorer(null);
        } else {
            setRemoteExplorer({
                teamCluster: remoteAccessRequest.teamCluster,
                session,
                target: remoteAccessRequest.target
            });
            setRemoteTerminal(null);
        }

        setRemoteAccessRequest(null);
        return remoteAccessRequest.target;
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
        remoteAccessRequest,
        remoteTerminal,
        remoteExplorer,
        setRemoteAccessRequest,
        submitRemoteAccessRequest,
        closeRemoteTerminal: () => setRemoteTerminal(null),
        closeRemoteExplorer: () => setRemoteExplorer(null),
        listRemoteExplorerEntries: management.listRemoteExplorerEntries,
        getRemoteExplorerNode: management.getRemoteExplorerNode,
        isLoading: management.isLoading
    };
};

export default useClustersPage;
