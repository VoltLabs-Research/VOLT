import { ErrorSurface, reportError } from '@/shared/errors/core';
import { useTeamClusterTransferJobsQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { Stack, Row, Text, Heading, Modal, StatusBadge, closeModal } from '@/shared/presentation/primitives';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import { Select } from '@/shared/presentation/primitives';
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
            <Stack gap='1' p='1-5'>
                <Stack gap='05'>
                    <Heading level={3} size='md' weight='medium' tone='secondary'>Destination cluster</Heading>
                    <Text as='p' size='md' tone='secondary'>
                        Volt creates one transfer job per authoritative placement currently owned by the source cluster.
                    </Text>
                </Stack>
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
                    <Text as='p' size='md' className='color-warning'>
                        No connected destination clusters can currently accept storage writes.
                    </Text>
                )}
                <Stack gap='05' p='1' radius='md' className='bg-page'>
                    <Text as='p' size='sm' tone='muted'>
                        Source cluster must stay connected during copy and verify. After the destination becomes authoritative, Volt removes the source MinIO objects and purges the related daemon Mongo cache automatically.
                    </Text>
                </Stack>
                {queuedMessage && (
                    <Text as='p' size='md' className='color-success'>{queuedMessage}</Text>
                )}
                {error && (
                    <Text as='p' size='md' className='color-danger'>{error}</Text>
                )}
                <Stack gap='075'>
                    <Heading level={3} size='md' weight='medium' tone='secondary'>Recent transfer jobs</Heading>
                    {transferJobsQuery.isLoading ? (
                        <Text as='p' size='sm' tone='muted'>Loading transfer jobs...</Text>
                    ) : transferJobs.length > 0 ? (
                        transferJobs.map((job) => (
                            <Stack key={job._id} gap='05' p='1' radius='md' className='bg-page'>
                                <Row gap='05' wrap>
                                    <StatusBadge variant={getClusterTransferJobStateBadgeVariant(job.state)} size='compact'>
                                        {getClusterTransferJobStateLabel(job.state)}
                                    </StatusBadge>
                                    <Text as='p' size='sm' tone='muted'>
                                        {getClusterTransferScopeLabel(job.scopeType)} {job.scopeId}
                                    </Text>
                                </Row>
                                <Text as='p' size='sm' tone='secondary'>
                                    {clusterNameById.get(job.sourceClusterId) ?? job.sourceClusterId}
                                    {' -> '}
                                    {clusterNameById.get(job.destinationClusterId) ?? job.destinationClusterId}
                                </Text>
                                <Text as='p' size='sm' tone='muted'>
                                    Copied {job.stats.copiedObjects} objects | Verified {job.stats.verifiedObjects} objects | Updated {formatClusterTimestamp(job.updatedAt)}
                                </Text>
                                {job.errorMessage && (
                                    <Text as='p' size='sm' className='color-danger'>{job.errorMessage}</Text>
                                )}
                            </Stack>
                        ))
                    ) : (
                        <Text as='p' size='sm' tone='muted'>No transfer jobs have been requested for this cluster yet.</Text>
                    )}
                </Stack>
            </Stack>
        </Modal>
    );
};

export default ClusterTransferModal;
