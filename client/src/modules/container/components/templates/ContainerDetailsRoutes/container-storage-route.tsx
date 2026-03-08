import ContainerFileExplorer from '../../organisms/ContainerFileExplorer';
import { Folder } from 'lucide-react';
import useContainerDetailsContext from '../../../hooks/use-container-details-context';
import EmptyState from '@/shared/presentation/components/EmptyState';

const ContainerStoragePage = () => {
    const { container, isRunning } = useContainerDetailsContext();

    if(!isRunning){
        return (
            <EmptyState
                icon={<Folder size={48} />}
                title='Container not running'
                description='Container must be running to browse files'
            />
        );
    }

    return <ContainerFileExplorer containerId={container._id} />;
};

export default ContainerStoragePage;
