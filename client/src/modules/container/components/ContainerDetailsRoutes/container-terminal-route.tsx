import ContainerTerminal from '../ContainerTerminal';
import { Terminal } from 'lucide-react';
import useContainerDetailsContext from '../../hooks/use-container-details-context';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';

const ContainerTerminalPage = () => {
    const { container, isRunning } = useContainerDetailsContext();

    if(!isRunning){
        return (
            <RecoveryState
                icon={<Terminal size={48} />}
                title='Container not running'
                description='Container must be running to open the terminal'
                tone={RecoveryStateTone.Empty}
            />
        );
    }

    return <ContainerTerminal container={container} embedded />;
};

export default ContainerTerminalPage;
