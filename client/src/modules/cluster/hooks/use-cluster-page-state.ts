import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import { useState } from 'react';
import type { CreateTeamClusterTransferRequestOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/create-team-cluster-transfer-request';
import type { DeleteTeamClusterOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/delete-team-cluster';
import type { TeamCluster, TeamClusterCredentialServices, TeamClusterRole } from '@/modules/cluster/api/entities/team-cluster';
import type {
    TeamClusterQueueConcurrencyInputDTO,
    TeamClusterQueueScopeLimitsInputDTO,
    UpdateTeamClusterQueueConcurrencyOutputDTO
} from '@/modules/cluster/api/dtos/team-cluster/update-team-cluster-queue-concurrency';
import type { UpdateTeamClusterRoleOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/update-team-cluster-role';

export interface ClusterPageState {
    clusters: TeamCluster[];
    selectedTeamId: string | null;
    selectedCluster: TeamCluster | null;
    selectedClusterId: string | null;
    setSelectedClusterId: (clusterId: string | null) => void;
    revealCredentials: (password: string) => Promise<void>;
    deleteCluster: (password: string) => Promise<DeleteTeamClusterOutputDTO>;
    updateQueueConcurrency: (input: {
        queueConcurrency: TeamClusterQueueConcurrencyInputDTO;
        queueScopeLimits: TeamClusterQueueScopeLimitsInputDTO;
    }) => Promise<UpdateTeamClusterQueueConcurrencyOutputDTO>;
    updateRole: (role: TeamClusterRole) => Promise<UpdateTeamClusterRoleOutputDTO>;
    createTransferRequest: (destinationClusterId: string) => Promise<CreateTeamClusterTransferRequestOutputDTO>;
    credentials: TeamClusterCredentialServices | null;
    credentialsCluster: TeamCluster | null;
    deleteTarget: TeamCluster | null;
    queueConcurrencyTarget: TeamCluster | null;
    roleTarget: TeamCluster | null;
    transferTarget: TeamCluster | null;
    setCredentialsCluster: (teamCluster: TeamCluster | null) => void;
    setDeleteTarget: (teamCluster: TeamCluster | null) => void;
    setQueueConcurrencyTarget: (teamCluster: TeamCluster | null) => void;
    setRoleTarget: (teamCluster: TeamCluster | null) => void;
    setTransferTarget: (teamCluster: TeamCluster | null) => void;
    isLoading: boolean;
}

const useClusterPageState = (): ClusterPageState => {
    const management = useClusterManagement();
    const [credentials, setCredentials] = useState<TeamClusterCredentialServices | null>(null);
    const [credentialsCluster, setCredentialsCluster] = useState<TeamCluster | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<TeamCluster | null>(null);
    const [queueConcurrencyTarget, setQueueConcurrencyTarget] = useState<TeamCluster | null>(null);
    const [roleTarget, setRoleTarget] = useState<TeamCluster | null>(null);
    const [transferTarget, setTransferTarget] = useState<TeamCluster | null>(null);

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

    const updateQueueConcurrency = async (input: {
        queueConcurrency: TeamClusterQueueConcurrencyInputDTO;
        queueScopeLimits: TeamClusterQueueScopeLimitsInputDTO;
    }) => {
        if (!queueConcurrencyTarget) {
            throw new Error('Missing cluster queue concurrency target');
        }

        return management.updateQueueConcurrency(
            queueConcurrencyTarget._id,
            input.queueConcurrency,
            input.queueScopeLimits
        );
    };

    const updateRole = async (role: TeamClusterRole) => {
        if (!roleTarget) {
            throw new Error('Missing cluster role target');
        }

        return management.updateRole(roleTarget._id, role);
    };

    const createTransferRequest = async (destinationClusterId: string) => {
        if (!transferTarget) {
            throw new Error('Missing cluster transfer target');
        }

        return management.createTransferRequest(transferTarget._id, destinationClusterId);
    };

    return {
        clusters: management.clusters,
        selectedTeamId: management.selectedTeamId,
        selectedCluster: management.selectedCluster,
        selectedClusterId: management.selectedClusterId,
        setSelectedClusterId: management.setSelectedClusterId,
        revealCredentials,
        deleteCluster,
        updateQueueConcurrency,
        updateRole,
        createTransferRequest,
        credentials,
        credentialsCluster,
        deleteTarget,
        queueConcurrencyTarget,
        roleTarget,
        transferTarget,
        setCredentialsCluster: (teamCluster) => {
            setCredentials(null);
            setCredentialsCluster(teamCluster);
        },
        setDeleteTarget,
        setQueueConcurrencyTarget,
        setRoleTarget,
        setTransferTarget,
        isLoading: management.isLoading
    };
};

export default useClusterPageState;
