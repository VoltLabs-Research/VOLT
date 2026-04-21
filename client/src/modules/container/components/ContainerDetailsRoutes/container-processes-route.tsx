import ContainerProcesses from '../ContainerProcesses';
import { Activity } from 'lucide-react';
import useContainerDetailsContext from '../../hooks/use-container-details-context';
import EmptyState from '@/shared/presentation/components/EmptyState';

const ContainerProcessesPage = () => {
    const { container, isRunning } = useContainerDetailsContext();

    if(!isRunning){
        return (
            <EmptyState
                icon={<Activity size={48} />}
                title='Container not running'
                description='Container must be running to view processes'
            />
        );
    }

    return <ContainerProcesses containerId={container._id} />;
};

export default ContainerProcessesPage;
