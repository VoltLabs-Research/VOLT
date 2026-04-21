import { ErrorSurface, reportError } from '@/shared/errors/core';
import { useTeamClusterTransferJobsQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { closeModal } from '@/shared/presentation/components/Modal';
import Modal from '@/shared/presentation/components/Modal';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Select from '@/shared/presentation/components/Select';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import { formatClusterTimestamp } from '@/modules/cluster/utilities/format-cluster-timestamp';
import {
    getClusterTransferJobStateBadgeVariant,
    getClusterTransferJobStateLabel,
    getClusterTransferScopeLabel,
    isClusterTransferJobOpen
} from '@/modules/cluster/utilities/team-cluster-transfer';
import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import { useEffect, useMemo, useState } from 'react';
import type { CreateTeamClusterTransferRequestOutputDTO } from '@/modules/cluster/api/dtos/team-cluster/create-team-cluster-transfer-request';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

interface ClusterTransferModalProps {
    teamCluster: TeamCluster | null;
    clusters: TeamCluster[];
    teamId: string | null;
    onSave: (destinationClusterId: string) => Promise<CreateTeamClusterTransferRequestOutputDTO>;
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

    const transferJobs = useMemo(() => {
        const jobs = transferJobsQuery.data?.data;
        return Array.isArray(jobs) ? jobs : [];
    }, [transferJobsQuery.data]);

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

    return (
        <Modal
            id={CLUSTER_TRANSFER_MODAL_ID}
            title={`Transfer cluster data for ${teamCluster?.name ?? 'cluster'}`}
            description='Queue storage transfer jobs from this cluster to another storage-capable cluster. The transfer always moves authoritative MinIO data and purges the source daemon Mongo cache after verify and switch complete.'
            footer={(
                <ModalFooterActions
                    secondary={{
                        label: 'Close',
                        onClick: handleClose,
                        disabled: isSubmitting
                    }}
                    primary={{
                        label: 'Queue transfer',
                        onClick: handleSave,
                        isLoading: isSubmitting,
                        disabled: !destinationClusterId
                    }}
                />
            )}
            onClose={handleClose}
        >
            <div className='volt-container d-flex column gap-1 p-1-5'>
                <div className='volt-container d-flex column gap-05'>
                    <h3 className='volt-title font-size-2 font-weight-5 color-secondary'>Destination cluster</h3>
                    <p className='volt-text font-size-2 color-secondary'>
                        Volt creates one transfer job per authoritative placement currently owned by the source cluster.
                    </p>
                </div>
                {destinationOptions.length > 0 ? (
                    <Select
                        options={destinationOptions}
                        value={destinationClusterId}
                        onChange={(value) => {
                            setDestinationClusterId(value);
                            if (error) {
                                setError(undefined);
                            }
                        }}
                        placeholder='Select destination cluster...'
                        disabled={isSubmitting}
                    />
                ) : (
                    <p className='volt-text font-size-2 color-warning'>
                        No connected destination clusters can currently accept storage writes.
                    </p>
                )}
                <div className='volt-container d-flex column gap-05 p-1 radius-md bg-page'>
                    <p className='volt-text font-size-1 color-muted'>
                        Source cluster must stay connected during copy and verify. After the destination becomes authoritative, Volt removes the source MinIO objects and purges the related daemon Mongo cache automatically.
                    </p>
                </div>
                {queuedMessage && (
                    <p className='volt-text font-size-2 color-success'>{queuedMessage}</p>
                )}
                {error && (
                    <p className='volt-text font-size-2 color-danger'>{error}</p>
                )}
                <div className='volt-container d-flex column gap-075'>
                    <h3 className='volt-title font-size-2 font-weight-5 color-secondary'>Recent transfer jobs</h3>
                    {transferJobsQuery.isLoading ? (
                        <p className='volt-text font-size-1 color-muted'>Loading transfer jobs...</p>
                    ) : transferJobs.length > 0 ? (
                        transferJobs.map((job) => (
                            <div key={job._id} className='volt-container d-flex column gap-05 p-1 radius-md bg-page'>
                                <div className='volt-container d-flex items-center gap-05 flex-wrap'>
                                    <StatusBadge variant={getClusterTransferJobStateBadgeVariant(job.state)} size='compact'>
                                        {getClusterTransferJobStateLabel(job.state)}
                                    </StatusBadge>
                                    <p className='volt-text font-size-1 color-muted'>
                                        {getClusterTransferScopeLabel(job.scopeType)} {job.scopeId}
                                    </p>
                                </div>
                                <p className='volt-text font-size-1 color-secondary'>
                                    {clusterNameById.get(job.sourceClusterId) ?? job.sourceClusterId}
                                    {' -> '}
                                    {clusterNameById.get(job.destinationClusterId) ?? job.destinationClusterId}
                                </p>
                                <p className='volt-text font-size-1 color-muted'>
                                    Copied {job.stats.copiedObjects} objects | Verified {job.stats.verifiedObjects} objects | Updated {formatClusterTimestamp(job.updatedAt)}
                                </p>
                                {job.errorMessage && (
                                    <p className='volt-text font-size-1 color-danger'>{job.errorMessage}</p>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className='volt-text font-size-1 color-muted'>No transfer jobs have been requested for this cluster yet.</p>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ClusterTransferModal;
