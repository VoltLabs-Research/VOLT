import './ClusterInstallCommandModal.css';
import Container from '@/shared/presentation/components/Container';
import CopyableField from '@/shared/presentation/components/CopyableField';
import Modal from '@/shared/presentation/components/Modal';
import Paragraph from '@/shared/presentation/components/Paragraph';
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
            <Container className='d-flex column gap-1 p-1'>
                <CopyableField
                    value={installCommand}
                    successMessage='Install command copied'
                />

                <Container className='d-flex items-center gap-05'>
                    <span className='cluster-install-command-status-dot' />
                    <Paragraph className='font-size-2 color-secondary'>
                        Waiting for connection
                    </Paragraph>
                </Container>
            </Container>
        </Modal>
    );
};

export default ClusterInstallCommandModal;
