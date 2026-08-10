import ContainerFileExplorer from '../ContainerFileExplorer';
import { Folder } from 'lucide-react';
import useContainerDetailsContext from '../../hooks/use-container-details-context';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';

const ContainerStoragePage = () => {
    const { container, isRunning } = useContainerDetailsContext();

    if(!isRunning){
        return (
            <RecoveryState
                icon={<Folder size={48} />}
                title='Container not running'
                description='Container must be running to browse files'
                tone={RecoveryStateTone.Empty}
            />
        );
    }

    return <ContainerFileExplorer containerId={container._id} />;
};

export default ContainerStoragePage;
