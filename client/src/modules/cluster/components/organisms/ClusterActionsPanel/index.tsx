import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

interface ClusterActionsPanelProps {
    teamCluster: TeamCluster | null;
    onRevealCredentials: () => void;
    onDeleteCluster: () => void;
    onUpdateCluster: () => void;
};

const ClusterActionsPanel = ({
    teamCluster,
    onRevealCredentials,
    onDeleteCluster,
    onUpdateCluster
}: ClusterActionsPanelProps) => {
    if (!teamCluster) {
        return null;
    }

    const isDeleting = teamCluster.status === TeamClusterStatus.Deleting;
    const isUpdating = teamCluster.status === TeamClusterStatus.Updating;
    const isUpdateFailed = teamCluster.status === TeamClusterStatus.UpdateFailed;
    const canUpdate = teamCluster.status === TeamClusterStatus.Connected
        || isUpdateFailed;
    const isDisabled = isDeleting || isUpdating;

    const descriptionText = () => {
        if (isDeleting) {
            return 'Remote uninstall is in progress. Volt will remove this cluster once cleanup is confirmed.';
        }
        if (isUpdating) {
            return 'Update is in progress. The daemon will reconnect once it restarts with the new version.';
        }
        if (isUpdateFailed) {
            return 'The last update attempt failed. Use "Update cluster" to retry with the same or a different version.';
        }
        return 'Reveal service credentials only when needed and confirm deletes with your password.';
    };

    return (
        <Container className='cluster-actions-panel d-flex column gap-2 p-1-5 radius-lg'>
            <Container className='d-flex column gap-1'>
                <Title className='font-size-3 font-weight-6 color-primary'>Sensitive Actions</Title>
                <Paragraph className='font-size-2 color-secondary'>
                    {descriptionText()}
                </Paragraph>
            </Container>
            <Container className='d-flex gap-075 flex-wrap'>
                <Button variant='outline' intent='neutral' onClick={onRevealCredentials} disabled={isDisabled}>
                    Reveal credentials
                </Button>
                <Button
                    variant='outline'
                    intent='brand'
                    onClick={onUpdateCluster}
                    disabled={!canUpdate || isUpdating}
                >
                    {isUpdating ? 'Updating...' : 'Update cluster'}
                </Button>
                <Button variant='solid' intent='danger' onClick={onDeleteCluster} disabled={isDisabled}>
                    {isDeleting ? 'Deleting...' : 'Delete cluster'}
                </Button>
                <Button variant='solid' intent='brand' shape='pill' size='sm' to='/onboarding/cluster/setup'>
                    Add New Cluster
                </Button>
            </Container>
        </Container>
    );
};

export default ClusterActionsPanel;
