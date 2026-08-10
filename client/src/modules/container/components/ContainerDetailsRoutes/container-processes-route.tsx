import ContainerProcesses from '../ContainerProcesses';
import { Activity } from 'lucide-react';
import useContainerDetailsContext from '../../hooks/use-container-details-context';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';

const ContainerProcessesPage = () => {
    const { container, isRunning } = useContainerDetailsContext();

    if(!isRunning){
        return (
            <RecoveryState
                icon={<Activity size={48} />}
                title='Container not running'
                description='Container must be running to view processes'
                tone={RecoveryStateTone.Empty}
            />
        );
    }

    return <ContainerProcesses containerId={container._id} />;
};

export default ContainerProcessesPage;
