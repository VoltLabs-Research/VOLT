import { LuArrowLeft, LuArrowUp } from 'react-icons/lu';
import Button from '@/shared/presentation/components/Button';
import Tooltip from '@/shared/presentation/components/Tooltip';
import Title from '@/shared/presentation/components/Title';

interface SSHExplorerHeaderLeftProps {
    connectionName: string | undefined;
    cwd: string;
    onBack: () => void;
    onGoUp: () => void;
};

const SSHExplorerHeaderLeft = ({ connectionName, cwd, onBack, onGoUp }: SSHExplorerHeaderLeftProps) => {
    const isAtRoot = !cwd || cwd === '.' || cwd === '/';

    return (
        <>
            <Tooltip content='Back to Connections' placement='bottom'>
                <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={onBack}>
                    <LuArrowLeft size={18} />
                </Button>
            </Tooltip>
            <Tooltip content='Go Up' placement='bottom'>
                <Button
                    variant='ghost'
                    intent='neutral'
                    iconOnly
                    size='sm'
                    onClick={onGoUp}
                    disabled={isAtRoot}
                >
                    <LuArrowUp size={18} />
                </Button>
            </Tooltip>
            {connectionName && (
                <Title className='font-size-3 font-weight-5 m-l-05'>{connectionName}</Title>
            )}
        </>
    );
};

export default SSHExplorerHeaderLeft;
