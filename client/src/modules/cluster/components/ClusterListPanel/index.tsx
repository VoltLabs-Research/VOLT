import './ClusterListPanel.css';
import ClusterInstallCommandModal, { CLUSTER_INSTALL_COMMAND_MODAL_ID } from '@/modules/cluster/components/ClusterInstallCommandModal';
import { useRegenerateTeamClusterEnrollmentTokenMutation } from '@/modules/cluster/hooks/team-cluster/queries';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utilities/team-cluster-status';
import { isTeamClusterWaiting } from '@/modules/cluster/utilities/is-team-cluster-waiting';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import Box from '@/shared/presentation/primitives/Box';
import Button from '@/shared/presentation/primitives/Button';
import IconButton from '@/shared/presentation/primitives/IconButton';
import { openModal } from '@/shared/presentation/primitives/Modal';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import StatusDot from '@/shared/presentation/primitives/StatusDot';
import Text from '@/shared/presentation/primitives/Text';
import Tooltip from '@/shared/presentation/primitives/Tooltip';
import type { StatusDotTone } from '@/shared/presentation/primitives/StatusDot';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

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
            <Row key={cluster._id} gap='05' className='cluster-list-panel-row'>
                <Stack gap='025' flex='1' minW='0'>
                    <Text as='p' size='md' tone='primary' weight='medium' truncate className='cluster-list-panel-name' title={cluster.name}>
                        {cluster.name}
                    </Text>
                    <Row gap='05'>
                        <StatusDot
                            tone={variant === 'inactive' ? 'neutral' : (variant as StatusDotTone)}
                            pulse={variant !== 'inactive'}
                            glow={variant !== 'inactive'}
                        />
                        <Text as='p' size='sm' tone='secondary'>{label}</Text>
                    </Row>
                </Stack>

                <Row gap='025' className='flex-shrink-0'>
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
                </Row>
            </Row>
        );
    };

    return (
        <Box className='cluster-list-panel'>
            <Box className='cluster-list-panel-header'>
                <Text as='p' size='md' weight='bold' tone='primary'>Your clusters</Text>
            </Box>
            <Box className='cluster-list-panel-list'>
                {clusters.map(renderRow)}
            </Box>

            <ClusterInstallCommandModal
                clusterId={installClusterId}
                enrollmentToken={installToken}
            />
        </Box>
    );
};

export default ClusterListPanel;
