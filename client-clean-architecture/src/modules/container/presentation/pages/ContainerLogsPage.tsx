import { Terminal } from 'lucide-react';
import useContainerDetailsContext from '../hooks/use-container-details-context';
import ContainerTerminal from '../components/organisms/ContainerTerminal';
import EmptyState from '@/shared/presentation/components/EmptyState';

const ContainerLogsPage = () => {
    const { container, isRunning } = useContainerDetailsContext();

    if(!isRunning){
        return (
            <EmptyState
                icon={<Terminal size={48} />}
                title='Container not running'
                description='Container must be running to view logs'
            />
        );
    }

    return <ContainerTerminal container={container} onClose={() => {}} embedded />;
};

export default ContainerLogsPage;
