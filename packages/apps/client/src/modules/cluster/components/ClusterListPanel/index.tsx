import { CLUSTER_INSTALL_COMMAND_MODAL_ID } from '@/modules/cluster/contracts/modal-ids';
import ClusterInstallCommandModal from '@/modules/cluster/components/ClusterInstallCommandModal';
import ClusterStatusDot from '@/modules/cluster/components/shared/ClusterStatusDot';
import { useRegenerateTeamClusterEnrollmentTokenMutation } from '@/modules/cluster/hooks/team-cluster/queries';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utils/team-cluster-status';
import { isTeamClusterWaiting } from '@/modules/cluster/utils/is-team-cluster-waiting';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { Button, Tooltip } from '@heroui/react';
import { openModal } from '@/shared/ui/modal/use-modal-store';
import { useId, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TeamCluster } from '@volt/contracts/modules/cluster/domain';

interface ClusterListPanelProps {
    clusters: TeamCluster[];
    onDelete: (cluster: TeamCluster) => void;
}

const ClusterListPanel = ({ clusters, onDelete }: ClusterListPanelProps) => {
    const selectedTeamId = useSelectedTeamId();
    const regenerateToken = useRegenerateTeamClusterEnrollmentTokenMutation();
    const [installClusterId, setInstallClusterId] = useState<string | null>(null);
    const [installToken, setInstallToken] = useState<string | null>(null);
    const headingId = useId();

    if (clusters.length === 0) {
        return null;
    }

    const handleConnect = async (cluster: TeamCluster) => {
        if (!selectedTeamId) {
            return;
        }

        const result = await regenerateToken.mutateAsync({
            teamId: selectedTeamId,
            teamClusterId: cluster._id
        });

        setInstallClusterId(cluster._id);
        setInstallToken(result.enrollmentToken);
        openModal(CLUSTER_INSTALL_COMMAND_MODAL_ID);
    };

    const renderRow = (cluster: TeamCluster): ReactNode => {
        const variant = getTeamClusterStatusVariant(cluster.status);
        const label = getTeamClusterStatusLabel(cluster.status);
        const canConnect = isTeamClusterWaiting(cluster.status);

        return (
            <li className='grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-1 py-2 text-base max-sm:grid-cols-[minmax(0,1fr)_auto] [&+&]:border-t [&+&]:border-separator' key={cluster._id}>
                <span className='truncate font-medium text-foreground' title={cluster.name}>
                    {cluster.name}
                </span>
                <span className='inline-flex items-center gap-2 text-sm text-muted max-sm:col-start-1 max-sm:row-start-2'>
                    <ClusterStatusDot
                        tone={variant === 'inactive' ? 'neutral' : variant}
                        pulse={variant !== 'inactive'}
                        glow={variant !== 'inactive'}
                    />
                    {label}
                </span>
                <div className='flex flex-row items-center gap-1 max-sm:row-span-2'>
                    {canConnect && (
                        <Button
                            variant='ghost'
                            size='sm'
                            className='text-muted hover:text-foreground'
                            onPress={() => handleConnect(cluster)}
                        >
                            Connect
                        </Button>
                    )}

                    <Tooltip delay={300} closeDelay={0}>
                        <Tooltip.Trigger>
                            <Button
                                variant='ghost'
                                size='sm'
                                isIconOnly
                                className='text-muted hover:text-foreground'
                                aria-label={`Delete cluster ${cluster.name}`}
                                onPress={() => onDelete(cluster)}
                            >
                                <Trash2 size={14} />
                            </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content placement='bottom'>
                            Delete cluster
                        </Tooltip.Content>
                    </Tooltip>
                </div>
            </li>
        );
    };

    // Plain rows under the form: the clusters already set up, and a way to finish connecting them.
    return (
        <section className='flex flex-col gap-2' aria-labelledby={headingId}>
            <h2 className='text-sm text-muted' id={headingId}>Your clusters</h2>
            <ul className='flex flex-col'>
                {clusters.map(renderRow)}
            </ul>
            <ClusterInstallCommandModal
                clusterId={installClusterId}
                enrollmentToken={installToken}
            />
        </section>
    );
};

export default ClusterListPanel;
