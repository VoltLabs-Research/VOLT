import './ClusterListPanel.css';
import ClusterInstallCommandModal, { CLUSTER_INSTALL_COMMAND_MODAL_ID } from '@/modules/cluster/components/ClusterInstallCommandModal';
import { useRegenerateTeamClusterEnrollmentTokenMutation } from '@/modules/cluster/hooks/team-cluster/queries';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utils/team-cluster-status';
import { isTeamClusterWaiting } from '@/modules/cluster/utils/is-team-cluster-waiting';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { Button, IconButton, openModal, StatusDot, Tooltip } from '@voltstack/bravais';
import type { StatusDotTone } from '@voltstack/bravais';
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
            <div className='flex flex-row items-center gap-2 cluster-list-panel-row' key={cluster._id}>
                <div className='flex flex-col gap-1 flex-1 min-w-0'>
                    <p className='text-sm font-medium text-foreground truncate cluster-list-panel-name' title={cluster.name}>
                        {cluster.name}
                    </p>
                    <div className='flex flex-row items-center gap-2'>
                        <StatusDot
                            tone={variant === 'inactive' ? 'neutral' : (variant as StatusDotTone)}
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
                            intent='brand'
                            size='sm'
                            onClick={() => handleConnect(cluster)}
                        >
                            Connect
                        </Button>
                    )}
                    <Tooltip content='Delete cluster' placement='bottom'>
                        <IconButton
                            variant='ghost'
                            size='sm'
                            title={`Delete cluster ${cluster.name}`}
                            aria-label={`Delete cluster ${cluster.name}`}
                            onClick={() => onDelete(cluster)}
                        >
                            <Trash2 size={14} />
                        </IconButton>
                    </Tooltip>
                </div>
            </div>
        );
    };

    return (
        <div className='cluster-list-panel'>
            <div className='cluster-list-panel-header'>
                <p className='text-sm font-semibold text-foreground'>Your clusters</p>
            </div>
            <div className='cluster-list-panel-list'>
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
