import { DEFAULT_CLUSTER_ID } from '@/modules/cluster/stores/constants';
import { useClusterStore } from '@/modules/cluster/stores/use-cluster-store';
import { useTeamClusterSocket } from '@/modules/cluster/hooks/team-cluster/use-team-cluster-socket';
import {
    useCreateTeamClusterMutation,
    useDeleteTeamClusterMutation,
    useRequestClusterUpdateMutation,
    useRevealTeamClusterCredentialsMutation,
    useTeamClustersQuery
} from '@/modules/cluster/hooks/team-cluster/queries';
import { teamClusterService } from '@/modules/cluster/api/service/team-cluster';
import { isTeamClusterWaiting } from '@/modules/cluster/utilities/is-team-cluster-waiting';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useMemo, useEffect } from 'react';
import type { DeleteTeamClusterOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/delete-team-cluster';
import type { RequestClusterUpdateOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/request-cluster-update';
import type { TeamCluster, TeamClusterCredentialServices } from '@/modules/cluster/api/entities/team-cluster';
import type {
    TeamClusterRemoteAccessSession,
    TeamClusterRemoteAccessTarget,
    TeamClusterRemoteExplorerEntry,
    TeamClusterRemoteExplorerNode
} from '@/modules/cluster/api/entities/team-cluster-remote-access';

interface ClusterCreateToastOptions {
    loading: { title: string };
    success: { title: string };
    error: { title: string };
};

interface DeleteClusterToastOptions {
    loading: { title: string };
    success: (result: DeleteTeamClusterOutputDTO) => {
        title: string;
        description: string;
    };
    error: {
        title: string;
    };
};

const CREATE_CLUSTER_TOAST_OPTIONS: ClusterCreateToastOptions = {
    loading: { title: 'Creating cluster...' },
    success: { title: 'Cluster created' },
    error: { title: 'Failed to create cluster' }
};

const REVEAL_CREDENTIALS_TOAST_OPTIONS: ClusterCreateToastOptions = {
    loading: { title: 'Revealing credentials...' },
    success: { title: 'Credentials revealed' },
    error: { title: 'Failed to reveal credentials' }
};

const REMOTE_ACCESS_TOAST_OPTIONS: Record<TeamClusterRemoteAccessTarget, ClusterCreateToastOptions> = {
    'host-terminal': {
        loading: { title: 'Opening terminal...' },
        success: { title: 'Terminal ready' },
        error: { title: 'Failed to open terminal' }
    },
    'mongo-documents': {
        loading: { title: 'Opening Mongo explorer...' },
        success: { title: 'Mongo explorer ready' },
        error: { title: 'Failed to open Mongo explorer' }
    },
    'redis-data': {
        loading: { title: 'Opening Redis explorer...' },
        success: { title: 'Redis explorer ready' },
        error: { title: 'Failed to open Redis explorer' }
    },
    minio: {
        loading: { title: 'Opening MinIO explorer...' },
        success: { title: 'MinIO explorer ready' },
        error: { title: 'Failed to open MinIO explorer' }
    }
};

const DELETE_CLUSTER_TOAST_OPTIONS: DeleteClusterToastOptions = {
    loading: { title: 'Deleting cluster...' },
    success: (result) => ({
        title: result.deleted ? 'Cluster deleted' : 'Remote uninstall requested',
        description: result.message
    }),
    error: { title: 'Failed to delete cluster' }
};

const UPDATE_CLUSTER_TOAST_OPTIONS: ClusterCreateToastOptions = {
    loading: { title: 'Requesting cluster update...' },
    success: { title: 'Update requested' },
    error: { title: 'Failed to request cluster update' }
};

export interface ClusterManagementResult {
    clusters: TeamCluster[];
    selectedTeamId: string | null;
    selectedCluster: TeamCluster | null;
    selectedClusterId: string;
    setSelectedClusterId: (clusterId: string) => void;
    waitingCluster: TeamCluster | null;
    isLoading: boolean;
    createCluster: (name: string) => Promise<{ teamCluster: TeamCluster; enrollmentToken: string }>;
    revealCredentials: (teamClusterId: string, password: string) => Promise<TeamClusterCredentialServices>;
    deleteCluster: (teamClusterId: string, password: string) => Promise<DeleteTeamClusterOutputDTO>;
    requestUpdate: (
        teamClusterId: string,
        targetVersion: string,
        isEdge: boolean,
        password: string
    ) => Promise<RequestClusterUpdateOutputDTO>;
    createRemoteAccessSession: (
        teamClusterId: string,
        password: string,
        target: TeamClusterRemoteAccessTarget
    ) => Promise<TeamClusterRemoteAccessSession>;
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
    downloadRemoteExplorerObject: (
        teamClusterId: string,
        sessionId: string,
        target: TeamClusterRemoteAccessTarget,
        path: string
    ) => Promise<Blob>;
};

const useClusterManagement = (): ClusterManagementResult => {
    const selectedTeamId = useSelectedTeamId();
    const selectedClusterId = useClusterStore((state) => state.selectedClusterId);
    const setSelectedClusterId = useClusterStore((state) => state.setSelectedClusterId);

    const teamClustersQuery = useTeamClustersQuery(selectedTeamId ?? '', {
        enabled: Boolean(selectedTeamId),
        refetchInterval: (query) => {
            const data = query.state.data?.data ?? [];
            return data.some((cluster) => isTeamClusterWaiting(cluster.status)) ? 3000 : false;
        }
    });
    const createMutation = useCreateTeamClusterMutation();
    const revealCredentialsMutation = useRevealTeamClusterCredentialsMutation();
    const deleteMutation = useDeleteTeamClusterMutation();
    const updateMutation = useRequestClusterUpdateMutation();

    const clusters = teamClustersQuery.data?.data ?? [];

    useEffect(() => {
        if (!clusters.length) {
            if (selectedClusterId !== DEFAULT_CLUSTER_ID) {
                setSelectedClusterId(DEFAULT_CLUSTER_ID);
            }
            return;
        }

        const hasSelectedCluster = clusters.some((cluster) => cluster._id === selectedClusterId);

        if (!hasSelectedCluster) {
            setSelectedClusterId(clusters[0]._id);
        }
    }, [clusters, selectedClusterId, setSelectedClusterId]);

    const selectedCluster = useMemo(() => {
        return clusters.find((cluster) => cluster._id === selectedClusterId) ?? clusters[0] ?? null;
    }, [clusters, selectedClusterId]);

    const waitingCluster = useMemo(() => {
        return clusters.find((cluster) => isTeamClusterWaiting(cluster.status)) ?? null;
    }, [clusters]);

    const allClusterIds = useMemo(() => {
        return clusters.map((cluster) => cluster._id);
    }, [clusters]);

    useTeamClusterSocket(allClusterIds);

    const createCluster = async (name: string) => {
        if (!selectedTeamId) {
            throw new Error('Missing selected team');
        }

        const result = await showPromise(createMutation.mutateAsync({
            teamId: selectedTeamId,
            name
        }), CREATE_CLUSTER_TOAST_OPTIONS);

        setSelectedClusterId(result.teamCluster._id);
        return result;
    };

    const revealCredentials = async (teamClusterId: string, password: string) => {
        if (!selectedTeamId) {
            throw new Error('Missing selected team');
        }

        const result = await showPromise(revealCredentialsMutation.mutateAsync({
            teamId: selectedTeamId,
            teamClusterId,
            password
        }), REVEAL_CREDENTIALS_TOAST_OPTIONS);

        return result.services;
    };

    const deleteCluster = async (teamClusterId: string, password: string) => {
        if (!selectedTeamId) {
            throw new Error('Missing selected team');
        }

        return showPromise(deleteMutation.mutateAsync({
            teamId: selectedTeamId,
            teamClusterId,
            password
        }), DELETE_CLUSTER_TOAST_OPTIONS);
    };

    const requestUpdate = async (
        teamClusterId: string,
        targetVersion: string,
        isEdge: boolean,
        password: string
    ) => {
        if (!selectedTeamId) {
            throw new Error('Missing selected team');
        }

        return showPromise(updateMutation.mutateAsync({
            teamId: selectedTeamId,
            teamClusterId,
            targetVersion,
            isEdge,
            password
        }), UPDATE_CLUSTER_TOAST_OPTIONS);
    };

    const createRemoteAccessSession = async (
        teamClusterId: string,
        password: string,
        target: TeamClusterRemoteAccessTarget
    ) => {
        if (!selectedTeamId) {
            throw new Error('Missing selected team');
        }

        const result = await showPromise(
            teamClusterService.createRemoteAccessSession({
                teamId: selectedTeamId,
                teamClusterId,
                password,
                target
            }),
            REMOTE_ACCESS_TOAST_OPTIONS[target]
        );

        return result.session;
    };

    const listRemoteExplorerEntries = async (
        teamClusterId: string,
        sessionId: string,
        target: TeamClusterRemoteAccessTarget,
        path: string
    ) => {
        if (!selectedTeamId) {
            throw new Error('Missing selected team');
        }

        const result = await teamClusterService.listRemoteExplorerEntries({
            teamId: selectedTeamId,
            teamClusterId,
            sessionId,
            target,
            path
        });

        return result.entries;
    };

    const getRemoteExplorerNode = async (
        teamClusterId: string,
        sessionId: string,
        target: TeamClusterRemoteAccessTarget,
        path: string
    ) => {
        if (!selectedTeamId) {
            throw new Error('Missing selected team');
        }

        const result = await teamClusterService.getRemoteExplorerNode({
            teamId: selectedTeamId,
            teamClusterId,
            sessionId,
            target,
            path
        });

        return result.node;
    };

    const downloadRemoteExplorerObject = async (
        teamClusterId: string,
        sessionId: string,
        target: TeamClusterRemoteAccessTarget,
        path: string
    ) => {
        if (!selectedTeamId) {
            throw new Error('Missing selected team');
        }

        return teamClusterService.downloadRemoteExplorerObject({
            teamId: selectedTeamId,
            teamClusterId,
            sessionId,
            target,
            path
        });
    };

    return {
        clusters,
        selectedTeamId,
        selectedCluster,
        selectedClusterId,
        setSelectedClusterId,
        waitingCluster,
        isLoading: teamClustersQuery.isLoading,
        createCluster,
        revealCredentials,
        deleteCluster,
        requestUpdate,
        createRemoteAccessSession,
        listRemoteExplorerEntries,
        getRemoteExplorerNode,
        downloadRemoteExplorerObject
    };
};

export default useClusterManagement;
