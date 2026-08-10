import ClusterInstallCommandPicker from '@/modules/cluster/components/ClusterInstallCommandPicker';
import ClusterStatusDot from '@/modules/cluster/components/shared/ClusterStatusDot';
import { Modal } from '@/shared/ui/modal';

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
            <div className='flex flex-col gap-4 p-4'>
                <ClusterInstallCommandPicker
                    clusterId={clusterId}
                    enrollmentToken={enrollmentToken}
                />

                <div className='flex flex-row items-center gap-2'>
                    <ClusterStatusDot tone='warning' pulse glow />
                    <p className='text-sm text-muted'>
                        Waiting for connection
                    </p>
                </div>
            </div>
        </Modal>
    );
};

export default ClusterInstallCommandModal;
