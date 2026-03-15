import ContainerRemoteDesktop from '../../organisms/ContainerRemoteDesktop';
import useContainerDetailsContext from '../../../hooks/use-container-details-context';
import { supportsRemoteDesktop } from '@/modules/container/utilities/supports-remote-desktop';
import { Monitor } from 'lucide-react';
import EmptyState from '@/shared/presentation/components/EmptyState';

const ContainerRemoteDesktopPage = () => {
    const { container, isRunning } = useContainerDetailsContext();
    const hasRemoteDesktop = supportsRemoteDesktop(container.capabilities);

    if (!hasRemoteDesktop) {
        return (
            <EmptyState
                icon={<Monitor size={48} />}
                title='Remote desktop unavailable'
                description='This container was not created with VNC remote desktop support.'
            />
        );
    }

    if (!isRunning) {
        return (
            <EmptyState
                icon={<Monitor size={48} />}
                title='Container not running'
                description='Start the container before opening the remote desktop.'
            />
        );
    }

    return <ContainerRemoteDesktop container={container} />;
};

export default ContainerRemoteDesktopPage;
