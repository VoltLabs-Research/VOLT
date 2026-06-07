import { useClusterStore } from '@/modules/cluster/stores/use-cluster-store';
import { useTeamClusterSocket } from '@/modules/cluster/hooks/team-cluster/use-team-cluster-socket';
import {
    useCreateTeamClusterTransferRequestMutation,
    useCreateTeamClusterMutation,
    useDeleteTeamClusterMutation,
    useRevealTeamClusterCredentialsMutation,
    useTeamClustersQuery,
    useUpdateTeamClusterQueueConcurrencyMutation,
    useUpdateTeamClusterRoleMutation
} from '@/modules/cluster/hooks/team-cluster/queries';
import { isTeamClusterWaiting } from '@/modules/cluster/utilities/is-team-cluster-waiting';
import { resolveSelectedClusterId } from '@/modules/cluster/utilities/resolve-selected-cluster-id';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useRequiredSelectedTeamId from '@/modules/team/hooks/ai-integration/use-required-selected-team-id';
import { useMemo } from 'react';
import type { TeamCluster, TeamClusterCredentialServices, TeamClusterRole } from '@/modules/cluster/api/entities/team-cluster';
import type {
    CreateTeamClusterTransferRequestOutputDTO,
    DeleteTeamClusterOutputDTO,
    TeamClusterQueueConcurrencyInputDTO,
    TeamClusterQueueScopeLimitsInputDTO,
    UpdateTeamClusterQueueConcurrencyOutputDTO,
    UpdateTeamClusterRoleOutputDTO
} from '@/modules/cluster/api/service';

interface ClusterCreateToastOptions {
    loading: { title: string };
    success: { title: string };
    error: { title: string };
}

interface DeleteClusterToastOptions {
    loading: { title: string };
    success: (result: DeleteTeamClusterOutputDTO) => {
        title: string;
        description: string;
    };
    error: {
        title: string;
    };
}

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

const DELETE_CLUSTER_TOAST_OPTIONS: DeleteClusterToastOptions = {
    loading: { title: 'Deleting cluster...' },
    success: (result) => ({
        title: result.deleted ? 'Cluster deleted' : 'Remote uninstall requested',
        description: result.message
    }),
    error: { title: 'Failed to delete cluster' }
};

const UPDATE_QUEUE_CONCURRENCY_TOAST_OPTIONS: ClusterCreateToastOptions = {
    loading: { title: 'Saving queue settings...' },
    success: { title: 'Queue settings saved' },
    error: { title: 'Failed to save queue settings' }
};

const UPDATE_CLUSTER_ROLE_TOAST_OPTIONS: ClusterCreateToastOptions = {
    loading: { title: 'Saving cluster role...' },
    success: { title: 'Cluster role saved' },
    error: { title: 'Failed to save cluster role' }
};

const CREATE_CLUSTER_TRANSFER_TOAST_OPTIONS = {
    loading: { title: 'Queueing transfer jobs...' },
    success: (result: CreateTeamClusterTransferRequestOutputDTO) => ({
        title: result.requestedJobs.length === 1 ? 'Transfer job queued' : 'Transfer jobs queued',
        description: result.message
    }),
    error: { title: 'Failed to queue transfer jobs' }
};

export interface ClusterManagementResult {
    clusters: TeamCluster[];
    selectedTeamId: string | null;
    selectedCluster: TeamCluster | null;
    selectedClusterId: string | null;
    setSelectedClusterId: (clusterId: string | null) => void;
    waitingCluster: TeamCluster | null;
    isLoading: boolean;
    error: Error | null;
    createCluster: (name: string) => Promise<{ teamCluster: TeamCluster; enrollmentToken: string }>;
    revealCredentials: (teamClusterId: string, password: string) => Promise<TeamClusterCredentialServices>;
    deleteCluster: (teamClusterId: string, password: string) => Promise<DeleteTeamClusterOutputDTO>;
    updateQueueConcurrency: (
        teamClusterId: string,
        queueConcurrency: TeamClusterQueueConcurrencyInputDTO,
        queueScopeLimits: TeamClusterQueueScopeLimitsInputDTO
    ) => Promise<UpdateTeamClusterQueueConcurrencyOutputDTO>;
    updateRole: (
        teamClusterId: string,
        role: TeamClusterRole
    ) => Promise<UpdateTeamClusterRoleOutputDTO>;
    createTransferRequest: (
        teamClusterId: string,
        destinationClusterId: string
    ) => Promise<CreateTeamClusterTransferRequestOutputDTO>;
}

const useClusterManagement = (): ClusterManagementResult => {
    const selectedTeamId = useSelectedTeamId();
    const requireSelectedTeamId = useRequiredSelectedTeamId();
    const selectedClusterId = useClusterStore((state) => state.selectedClusterId);
    const setSelectedClusterId = useClusterStore((state) => state.setSelectedClusterId);

    const teamClustersQuery = useTeamClustersQuery(selectedTeamId ?? '', {
        enabled: Boolean(selectedTeamId),
        refetchInterval: (query) => {
            if (document.hidden) {
                return false;
            }

            const data = query.state.data?.data ?? [];
            return data.some((cluster) => isTeamClusterWaiting(cluster.status)) ? 5000 : false;
        }
    });
    const createMutation = useCreateTeamClusterMutation();
    const revealCredentialsMutation = useRevealTeamClusterCredentialsMutation();
    const deleteMutation = useDeleteTeamClusterMutation();
    const updateQueueConcurrencyMutation = useUpdateTeamClusterQueueConcurrencyMutation();
    const updateRoleMutation = useUpdateTeamClusterRoleMutation();
    const createTransferRequestMutation = useCreateTeamClusterTransferRequestMutation();

    const clusters = teamClustersQuery.data?.data ?? [];
    const resolvedSelectedClusterId = useMemo(() => {
        return resolveSelectedClusterId(selectedClusterId, clusters);
    }, [clusters, selectedClusterId]);

    const selectedCluster = useMemo(() => {
        return clusters.find((cluster) => cluster._id === resolvedSelectedClusterId) ?? null;
    }, [clusters, resolvedSelectedClusterId]);

    const waitingCluster = useMemo(() => {
        return clusters.find((cluster) => isTeamClusterWaiting(cluster.status)) ?? null;
    }, [clusters]);

    const allClusterIds = useMemo(() => {
        return clusters.map((cluster) => cluster._id);
    }, [clusters]);

    useTeamClusterSocket(allClusterIds);

    const createCluster = async (name: string) => {
        const result = await showPromise(createMutation.mutateAsync({
            teamId: requireSelectedTeamId(),
            name
        }), CREATE_CLUSTER_TOAST_OPTIONS);

        setSelectedClusterId(result.teamCluster._id);
        return result;
    };

    const revealCredentials = async (teamClusterId: string, password: string) => {
        const result = await showPromise(revealCredentialsMutation.mutateAsync({
            teamId: requireSelectedTeamId(),
            teamClusterId,
            password
        }), REVEAL_CREDENTIALS_TOAST_OPTIONS);

        return result.services;
    };

    const deleteCluster = async (teamClusterId: string, password: string) => {
        return showPromise(deleteMutation.mutateAsync({
            teamId: requireSelectedTeamId(),
            teamClusterId,
            password
        }), DELETE_CLUSTER_TOAST_OPTIONS);
    };

    const updateQueueConcurrency = async (
        teamClusterId: string,
        queueConcurrency: TeamClusterQueueConcurrencyInputDTO,
        queueScopeLimits: TeamClusterQueueScopeLimitsInputDTO
    ) => {
        return showPromise(updateQueueConcurrencyMutation.mutateAsync({
            teamId: requireSelectedTeamId(),
            teamClusterId,
            queueConcurrency,
            queueScopeLimits
        }), UPDATE_QUEUE_CONCURRENCY_TOAST_OPTIONS);
    };

    const updateRole = async (
        teamClusterId: string,
        role: TeamClusterRole
    ) => {
        return showPromise(updateRoleMutation.mutateAsync({
            teamId: requireSelectedTeamId(),
            teamClusterId,
            role
        }), UPDATE_CLUSTER_ROLE_TOAST_OPTIONS);
    };

    const createTransferRequest = async (
        teamClusterId: string,
        destinationClusterId: string
    ) => {
        return showPromise(createTransferRequestMutation.mutateAsync({
            teamId: requireSelectedTeamId(),
            teamClusterId,
            destinationClusterId
        }), CREATE_CLUSTER_TRANSFER_TOAST_OPTIONS);
    };

    return {
        clusters,
        selectedTeamId,
        selectedCluster,
        selectedClusterId: resolvedSelectedClusterId,
        setSelectedClusterId,
        waitingCluster,
        isLoading: teamClustersQuery.isLoading,
        error: teamClustersQuery.error,
        createCluster,
        revealCredentials,
        deleteCluster,
        updateQueueConcurrency,
        updateRole,
        createTransferRequest
    };
};

export default useClusterManagement;
