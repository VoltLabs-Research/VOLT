import ContainerRemoteDesktop from '../../organisms/ContainerRemoteDesktop';
import { Monitor } from 'lucide-react';
import useContainerDetailsContext from '../../../hooks/use-container-details-context';
import EmptyState from '@/shared/presentation/components/EmptyState';

const ContainerRemoteDesktopPage = () => {
    const { container, isRunning } = useContainerDetailsContext();
    const supportsXrdp = !!container.capabilities?.xrdp;

    if (!supportsXrdp) {
        return (
            <EmptyState
                icon={<Monitor size={48} />}
                title='Remote desktop unavailable'
                description='This container was not created with XRDP support.'
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
