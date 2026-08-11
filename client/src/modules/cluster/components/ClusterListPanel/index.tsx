import ClusterInstallCommandModal, { CLUSTER_INSTALL_COMMAND_MODAL_ID } from '@/modules/cluster/components/ClusterInstallCommandModal';
import ClusterStatusDot from '@/modules/cluster/components/shared/ClusterStatusDot';
import { useRegenerateTeamClusterEnrollmentTokenMutation } from '@/modules/cluster/hooks/team-cluster/queries';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utils/team-cluster-status';
import { isTeamClusterWaiting } from '@/modules/cluster/utils/is-team-cluster-waiting';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { Button, Tooltip } from '@heroui/react';
import { openModal } from '@/shared/ui/modal/use-modal-store';
import { useState } from 'react';
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
            <div className='flex flex-row items-center gap-2 px-3 py-2 transition-colors duration-150 ease-out [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border hover:bg-surface-tertiary focus-within:bg-surface-tertiary' key={cluster._id}>
                <div className='flex flex-col gap-1 flex-1 min-w-0'>
                    <p className='text-sm font-medium text-foreground truncate min-w-0' title={cluster.name}>
                        {cluster.name}
                    </p>
                    <div className='flex flex-row items-center gap-2'>
                        <ClusterStatusDot
                            tone={variant === 'inactive' ? 'neutral' : variant}
                            pulse={variant !== 'inactive'}
                            glow={variant !== 'inactive'}
                        />
                        <p className='text-xs text-muted'>{label}</p>
                    </div>
                </div>
                <div className='flex flex-row items-center gap-1 flex-shrink-0'>
                    {canConnect && (
                        <Button
                            variant='ghost'
                            size='sm'
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
            </div>
        );
    };

    return (
        <div className='fixed top-20 left-6 w-[280px] max-h-[min(320px,calc(100dvh-10rem))] overflow-hidden max-md:top-auto max-md:right-[max(0.75rem,env(safe-area-inset-right,0px))] max-md:bottom-[calc(max(4.25rem,env(safe-area-inset-bottom,0px))+3.25rem)] max-md:left-[max(0.75rem,env(safe-area-inset-left,0px))] max-md:w-auto max-md:max-h-[min(280px,calc(100dvh-12rem))]'>
            <div className='px-3 py-2.5 border-b border-border'>
                <p className='text-sm font-semibold text-foreground'>Your clusters</p>
            </div>
            <div className='overflow-y-auto max-h-[min(264px,calc(100dvh-14rem))] max-md:max-h-[min(224px,calc(100dvh-16rem))]'>
                {clusters.map(renderRow)}
            </div>
            <ClusterInstallCommandModal
                clusterId={installClusterId}
                enrollmentToken={installToken}
            />
        </div>
    );
};

export default ClusterListPanel;
