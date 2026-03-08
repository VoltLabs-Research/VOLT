import ContainerTerminal from '../../organisms/ContainerTerminal';
import { Terminal } from 'lucide-react';
import useContainerDetailsContext from '../../../hooks/use-container-details-context';
import EmptyState from '@/shared/presentation/components/EmptyState';

const ContainerTerminalPage = () => {
    const { container, isRunning } = useContainerDetailsContext();

    if(!isRunning){
        return (
            <EmptyState
                icon={<Terminal size={48} />}
                title='Container not running'
                description='Container must be running to open the terminal'
            />
        );
    }

    return <ContainerTerminal container={container} onClose={() => {}} embedded />;
};

export default ContainerTerminalPage;
