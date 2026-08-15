import { CLUSTER_QUEUE_CONCURRENCY_MODAL_ID, CLUSTER_ROLE_MODAL_ID, CLUSTER_TRANSFER_MODAL_ID, DELETE_CLUSTER_MODAL_ID } from '@/modules/cluster/contracts/modal-ids';
import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import { useModalPayload } from '@/shared/ui/modal/use-modal-store';
import type { TeamCluster,  TeamClusterRole } from '@volt/contracts/modules/cluster/domain';
import type { TeamClusterQueueConcurrency, TeamClusterQueueScopeLimits } from '@volt/contracts/modules/cluster/domain';

const useClusterPageState = () => {
    const management = useClusterManagement();
    const deleteTarget = useModalPayload<TeamCluster>(DELETE_CLUSTER_MODAL_ID);
    const queueConcurrencyTarget = useModalPayload<TeamCluster>(CLUSTER_QUEUE_CONCURRENCY_MODAL_ID);
    const roleTarget = useModalPayload<TeamCluster>(CLUSTER_ROLE_MODAL_ID);
    const transferTarget = useModalPayload<TeamCluster>(CLUSTER_TRANSFER_MODAL_ID);

    const deleteCluster = async (password: string) => {
        if (!deleteTarget) {
            throw new Error('Missing cluster delete target');
        }

        return management.deleteCluster(deleteTarget._id, password);
    };

    const updateQueueConcurrency = async (input: {
        queueConcurrency: TeamClusterQueueConcurrency;
        queueScopeLimits: TeamClusterQueueScopeLimits;
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
        deleteCluster,
        updateQueueConcurrency,
        updateRole,
        createTransferRequest,
        deleteTarget,
        queueConcurrencyTarget,
        roleTarget,
        transferTarget,
        isLoading: management.isLoading
    };
};

export default useClusterPageState;
