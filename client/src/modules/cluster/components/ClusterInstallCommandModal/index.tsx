import ClusterInstallCommandPicker from '@/modules/cluster/components/ClusterInstallCommandPicker';
import { Modal, Row, Stack, StatusDot, Text } from '@voltstack/bravais';

export const CLUSTER_INSTALL_COMMAND_MODAL_ID = 'cluster-install-command-modal';

interface ClusterInstallCommandModalProps {
    clusterId: string | null;
    enrollmentToken: string | null;
}

const ClusterInstallCommandModal = ({ clusterId, enrollmentToken }: ClusterInstallCommandModalProps) => {
    return (
        <Modal
            id={CLUSTER_INSTALL_COMMAND_MODAL_ID}
            title='Install command'
            description='This command installs the Volt Cluster Daemon, enabling Volt servers to communicate with the machine and use it as a compute resource.'
        >
            <Stack gap='1' p='1'>
                <ClusterInstallCommandPicker
                    clusterId={clusterId}
                    enrollmentToken={enrollmentToken}
                />

                <Row gap='05'>
                    <StatusDot tone='warning' pulse glow />
                    <Text as='p' size='md' tone='secondary'>
                        Waiting for connection
                    </Text>
                </Row>
            </Stack>
        </Modal>
    );
};

export default ClusterInstallCommandModal;
