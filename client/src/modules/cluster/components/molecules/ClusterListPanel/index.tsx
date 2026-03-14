import './ClusterListPanel.css';
import ClusterInstallCommandModal, { CLUSTER_INSTALL_COMMAND_MODAL_ID } from '@/modules/cluster/components/organisms/ClusterInstallCommandModal';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { useRegenerateTeamClusterEnrollmentTokenMutation } from '@/modules/cluster/hooks/team-cluster/queries';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utilities/team-cluster-status';
import { isTeamClusterWaiting } from '@/modules/cluster/utilities/is-team-cluster-waiting';
import { openModal } from '@/shared/presentation/components/Modal';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

interface ClusterListPanelProps {
    clusters: TeamCluster[];
    onDelete: (cluster: TeamCluster) => void;
};

const ClusterListPanel = ({ clusters, onDelete }: ClusterListPanelProps) => {
    const selectedTeamId = useSelectedTeamId();
    const regenerateToken = useRegenerateTeamClusterEnrollmentTokenMutation();
    const [installClusterId, setInstallClusterId] = useState<string | null>(null);
    const [installToken, setInstallToken] = useState<string | null>(null);

    if (clusters.length === 0) return null;

    const handleConnect = async (cluster: TeamCluster) => {
        if (!selectedTeamId) return;

        const result = await regenerateToken.mutateAsync({
            teamId: selectedTeamId,
            teamClusterId: cluster._id
        });

        setInstallClusterId(cluster._id);
        setInstallToken(result.enrollmentToken);
        openModal(CLUSTER_INSTALL_COMMAND_MODAL_ID);
    };

    const renderRow = (cluster: TeamCluster) => {
        const variant = getTeamClusterStatusVariant(cluster.status);
        const label = getTeamClusterStatusLabel(cluster.status);
        const canConnect = isTeamClusterWaiting(cluster.status);

        return (
            <Container key={cluster._id} className='cluster-list-panel-row d-flex items-center gap-05'>
                <Container className='d-flex column gap-025 flex-1 min-w-0'>
                    <Paragraph className='cluster-list-panel-name font-size-2 color-primary font-weight-5'>
                        {cluster.name}
                    </Paragraph>
                    <Container className='d-flex items-center gap-05'>
                        <span className={`cluster-list-panel-dot variant-${variant}`} />
                        <Paragraph className='font-size-1 color-secondary'>{label}</Paragraph>
                    </Container>
                </Container>

                <Container className='d-flex items-center gap-025 flex-shrink-0'>
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
                </Container>
            </Container>
        );
    };

    return (
        <Container className='cluster-list-panel'>
            <Container className='cluster-list-panel-header'>
                <Paragraph className='font-size-2 font-weight-6 color-primary'>Your clusters</Paragraph>
            </Container>
            <Container className='cluster-list-panel-list'>
                {clusters.map(renderRow)}
            </Container>

            <ClusterInstallCommandModal
                clusterId={installClusterId}
                enrollmentToken={installToken}
            />
        </Container>
    );
};

export default ClusterListPanel;
