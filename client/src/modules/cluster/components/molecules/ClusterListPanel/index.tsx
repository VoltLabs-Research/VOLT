import './ClusterListPanel.css';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utilities/team-cluster-status';
import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import { Trash2 } from 'lucide-react';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

interface ClusterListPanelProps {
    clusters: TeamCluster[];
    enrollmentTokens: Map<string, string>;
    onConnect: (cluster: TeamCluster) => void;
    onDelete: (cluster: TeamCluster) => void;
};

const ClusterListPanel = ({ clusters, enrollmentTokens, onConnect, onDelete }: ClusterListPanelProps) => {
    if (clusters.length === 0) return null;

    const renderRow = (cluster: TeamCluster) => {
        const variant = getTeamClusterStatusVariant(cluster.status);
        const label = getTeamClusterStatusLabel(cluster.status);
        const canConnect = cluster.status !== TeamClusterStatus.Connected
            && enrollmentTokens.has(cluster._id);

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
                            onClick={() => onConnect(cluster)}
                        >
                            Connect
                        </Button>
                    )}
                    <Tooltip content='Delete cluster' placement='bottom'>
                        <IconButton
                            variant='ghost'
                            size='sm'
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
        </Container>
    );
};

export default ClusterListPanel;
