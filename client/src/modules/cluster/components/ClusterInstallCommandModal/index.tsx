import CopyableField from '@/shared/presentation/components/CopyableField';
import Modal from '@/shared/presentation/primitives/Modal';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import StatusDot from '@/shared/presentation/primitives/StatusDot';
import Text from '@/shared/presentation/primitives/Text';
import { buildClusterInstallCommand } from '@/modules/cluster/utilities/build-cluster-install-command';

export const CLUSTER_INSTALL_COMMAND_MODAL_ID = 'cluster-install-command-modal';

interface ClusterInstallCommandModalProps {
    clusterId: string | null;
    enrollmentToken: string | null;
};

const ClusterInstallCommandModal = ({ clusterId, enrollmentToken }: ClusterInstallCommandModalProps) => {
    const installCommand = clusterId && enrollmentToken
        ? buildClusterInstallCommand(clusterId, enrollmentToken)
        : '';

    return (
        <Modal
            id={CLUSTER_INSTALL_COMMAND_MODAL_ID}
            title='Install command'
            description='This command installs the Volt Cluster Daemon, enabling Volt servers to communicate with the machine and use it as a compute resource.'
        >
            <Stack gap='1' p='1'>
                <CopyableField
                    value={installCommand}
                    successMessage='Install command copied'
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
