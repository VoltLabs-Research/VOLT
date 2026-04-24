import Button from '@/shared/presentation/primitives/Button';
import Tooltip from '@/shared/presentation/primitives/Tooltip';
import { LuArrowLeft, LuArrowUp } from 'react-icons/lu';

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
                <Button variant='ghost' intent='neutral' iconOnly size='sm' aria-label='Back to connections' title='Back to connections' onClick={onBack}>
                    <LuArrowLeft size={18} />
                </Button>
            </Tooltip>
            <Tooltip content='Go Up' placement='bottom'>
                <Button
                    variant='ghost'
                    intent='neutral'
                    iconOnly
                    size='sm'
                    aria-label='Go up'
                    onClick={onGoUp}
                    disabled={isAtRoot}
                    title='Go up'
                >
                    <LuArrowUp size={18} />
                </Button>
            </Tooltip>
            {connectionName && (
                <h1 className='font-size-3 font-weight-5 m-l-05'>{connectionName}</h1>
            )}
        </>
    );
};

export default SSHExplorerHeaderLeft;
