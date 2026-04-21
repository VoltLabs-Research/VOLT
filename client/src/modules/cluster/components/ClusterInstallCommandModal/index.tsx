import './ClusterInstallCommandModal.css';
import CopyableField from '@/shared/presentation/components/CopyableField';
import Modal from '@/shared/presentation/components/Modal';
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
            <div className='volt-container d-flex column gap-1 p-1'>
                <CopyableField
                    value={installCommand}
                    successMessage='Install command copied'
                />

                <div className='volt-container d-flex items-center gap-05'>
                    <span className='cluster-install-command-status-dot' />
                    <p className='volt-text font-size-2 color-secondary'>
                        Waiting for connection
                    </p>
                </div>
            </div>
        </Modal>
    );
};

export default ClusterInstallCommandModal;
