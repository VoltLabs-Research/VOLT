import { ErrorSurface } from '@/shared/contracts/errors';
import { reportError } from '@/shared/errors/core/report-error';
import { useTeamClusterTransferJobsQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { Modal } from '@/shared/ui/modal/Modal';
import { closeModal } from '@/shared/ui/modal/use-modal-store';
import ClusterModalActionFooter from '@/modules/cluster/components/shared/ClusterModalActionFooter';
import ClusterOptionSelect from '@/modules/cluster/components/shared/ClusterOptionSelect';
import ClusterStatusBadge from '@/modules/cluster/components/shared/ClusterStatusBadge';
import { formatClusterTimestamp } from '@/modules/cluster/utils/format-cluster-timestamp';
import {
    getClusterTransferJobStateBadgeVariant,
    getClusterTransferJobStateLabel,
    getClusterTransferScopeLabel,
    isClusterTransferJobOpen
} from '@/modules/cluster/utils/team-cluster-transfer';
import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import { useEffect, useMemo, useState } from 'react';
import type { CreateTeamClusterTransferRequestResponse } from '@volt/contracts/modules/cluster/domain';
import type { TeamCluster } from '@volt/contracts/modules/cluster/domain';

interface ClusterTransferModalProps {
    teamCluster: TeamCluster | null;
    clusters: TeamCluster[];
    teamId: string | null;
    onSave: (destinationClusterId: string) => Promise<CreateTeamClusterTransferRequestResponse>;
    onClose: () => void;
}

export const CLUSTER_TRANSFER_MODAL_ID = 'cluster-transfer-modal';

const ClusterTransferModal = ({
    teamCluster,
    clusters,
    teamId,
    onSave,
    onClose
}: ClusterTransferModalProps) => {
    const [destinationClusterId, setDestinationClusterId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const [queuedMessage, setQueuedMessage] = useState<string | null>(null);

    const destinationOptions = useMemo(() => {
        return clusters
            .filter((cluster) => cluster._id !== teamCluster?._id)
            .filter((cluster) => cluster.status === TeamClusterStatus.Connected)
            .filter((cluster) => cluster.effectiveCapabilities.acceptsStorageWrites)
            .map((cluster) => ({
                value: cluster._id,
                title: cluster.name,
                description: `${cluster.roleConfig.effectiveRole} | ${cluster._id}`
            }));
    }, [clusters, teamCluster?._id]);

    useEffect(() => {
        setDestinationClusterId(destinationOptions[0]?.value ?? null);
        setIsSubmitting(false);
        setError(undefined);
        setQueuedMessage(null);
    }, [destinationOptions, teamCluster]);

    const transferJobsQuery = useTeamClusterTransferJobsQuery({
        teamId: teamId ?? '',
        teamClusterId: teamCluster?._id ?? '',
        page: 1,
        limit: 8
    }, {
        enabled: Boolean(teamId) && Boolean(teamCluster?._id),
        refetchInterval: (query) => {
            const jobs = query.state.data?.data ?? [];
            return jobs.some(isClusterTransferJobOpen) ? 3000 : false;
        }
    });

    const transferJobs = transferJobsQuery.data?.data ?? [];

    const clusterNameById = useMemo(() => {
        return new Map(clusters.map((cluster) => [cluster._id, cluster.name]));
    }, [clusters]);

    const handleClose = () => {
        setError(undefined);
        setQueuedMessage(null);
        closeModal(CLUSTER_TRANSFER_MODAL_ID);
        onClose();
    };

    const handleSave = async () => {
        if (!destinationClusterId) {
            setError('Select a destination cluster first.');
            return;
        }

        setIsSubmitting(true);
        setError(undefined);

        try {
            const result = await onSave(destinationClusterId);
            setQueuedMessage(result.message);
            await transferJobsQuery.refetch();
        } catch (err: unknown) {
            setError(reportError(err, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to queue transfer jobs'
            }).title);
        } finally {
            setIsSubmitting(false);
        }
    };

    const footer = (
        <ClusterModalActionFooter
            cancelLabel='Close'
            confirmLabel='Queue transfer'
            onCancel={handleClose}
            onConfirm={handleSave}
            isSubmitting={isSubmitting}
            confirmDisabled={!destinationClusterId}
        />
    );

    return (
        <Modal id={CLUSTER_TRANSFER_MODAL_ID} title={`Transfer cluster data for ${teamCluster?.name ?? 'cluster'}`} description='Queue storage transfer jobs from this cluster to another storage-capable cluster. The transfer always moves authoritative object store data and purges the source daemon listing tables after verify and switch complete.' footer={footer} onClose={handleClose}>
            <div className='flex flex-col gap-4'>
                <div className='flex flex-col gap-2'>
                    <h3 className='text-sm font-medium text-muted'>Destination cluster</h3>
                    <p className='text-sm text-muted'>
                        Volt creates one transfer job per authoritative placement currently owned by the source cluster.
                    </p>
                </div>
                {destinationOptions.length > 0 ? (
                    <ClusterOptionSelect
                        ariaLabel='Destination cluster'
                        options={destinationOptions}
                        value={destinationClusterId}
                        onChange={(value) => {
                            setDestinationClusterId(value);
                            if (error) {
                                setError(undefined);
                            }
                        }}
                        placeholder='Select destination cluster...'
                        isDisabled={isSubmitting}
                    />
                ) : (
                    <p className='text-sm text-warning'>
                        No connected destination clusters can currently accept storage writes.
                    </p>
                )}
                <div className='flex flex-col gap-2 p-4 rounded-xl bg-background'>
                    <p className='text-xs text-muted'>
                        Source cluster must stay connected during copy and verify. After the destination becomes authoritative, Volt removes the source objects and purges the related daemon listing tables automatically.
                    </p>
                </div>
                {queuedMessage && (
                    <p className='text-sm text-success'>{queuedMessage}</p>
                )}
                {error && (
                    <p className='text-sm text-danger'>{error}</p>
                )}
                <div className='flex flex-col gap-3'>
                    <h3 className='text-sm font-medium text-muted'>Recent transfer jobs</h3>
                    {transferJobsQuery.isLoading ? (
                        <p className='text-xs text-muted'>Loading transfer jobs...</p>
                    ) : transferJobs.length > 0 ? (
                        transferJobs.map((job) => (
                            <div className='flex flex-col gap-2 p-4 rounded-xl bg-background' key={job._id}>
                                <div className='flex flex-row items-center flex-wrap gap-2'>
                                    <ClusterStatusBadge tone={getClusterTransferJobStateBadgeVariant(job.state)}>
                                        {getClusterTransferJobStateLabel(job.state)}
                                    </ClusterStatusBadge>
                                    <p className='text-xs text-muted'>
                                        {getClusterTransferScopeLabel(job.scopeType)} {job.scopeId}
                                    </p>
                                </div>
                                <p className='text-xs text-muted'>
                                    {clusterNameById.get(job.sourceClusterId) ?? job.sourceClusterId}
                                    {' -> '}
                                    {clusterNameById.get(job.destinationClusterId) ?? job.destinationClusterId}
                                </p>
                                <p className='text-xs text-muted'>
                                    Copied {job.stats.copiedObjects} objects | Verified {job.stats.verifiedObjects} objects | Updated {formatClusterTimestamp(job.updatedAt)}
                                </p>
                                {job.errorMessage && (
                                    <p className='text-xs text-danger'>{job.errorMessage}</p>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className='text-xs text-muted'>No transfer jobs have been requested for this cluster yet.</p>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ClusterTransferModal;
