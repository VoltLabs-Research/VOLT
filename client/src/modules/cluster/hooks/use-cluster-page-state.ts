import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import { useState } from 'react';
import type { TeamCluster, TeamClusterCredentialServices, TeamClusterRole } from '@/modules/cluster/api/types/team-cluster';
import type {
    TeamClusterQueueConcurrencyInput,
    TeamClusterQueueScopeLimitsInput
} from '@/modules/cluster/api/service';

const useClusterPageState = () => {
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
        queueConcurrency: TeamClusterQueueConcurrencyInput;
        queueScopeLimits: TeamClusterQueueScopeLimitsInput;
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
        setCredentialsCluster: (teamCluster: TeamCluster | null) => {
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
