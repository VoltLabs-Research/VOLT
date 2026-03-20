import { useEffect, useMemo, useRef } from 'react';
import { IoClose } from 'react-icons/io5';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import { useSocketTerminalSession } from '@/modules/socket/core/hooks/use-socket-terminal-session';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Tooltip from '@/shared/presentation/components/Tooltip';
import Terminal from '@/shared/presentation/components/Terminal';
import type { TerminalHandle } from '@/shared/presentation/components/Terminal';
import './ContainerTerminal.css';

interface ContainerTerminalProps {
    container: {
        _id: string;
        name: string;
        containerId: string;
    };
    onClose: () => void;
    embedded?: boolean;
    appendOutput?: {
        id: number;
        data: string;
    } | null;
};

interface ContainerTerminalSocketError {
    code: string;
    message: string;
    details?: string;
};

const isContainerTerminalSocketError = (value: unknown): value is ContainerTerminalSocketError => {
    return typeof value === 'object' && value !== null && 'message' in value && 'code' in value;
};

export const ContainerTerminal = ({ container, onClose, embedded = false, appendOutput = null }: ContainerTerminalProps) => {
    const terminalRef = useRef<TerminalHandle>(null);
    const socketService = useSocket();
    const attachPayload = useMemo(() => ({ containerId: container._id }), [container._id]);
    const resolveErrorMessage = useMemo(() => {
        return (error: unknown): string => {
            if (typeof error === 'string') {
                return error;
            }

            if (isContainerTerminalSocketError(error)) {
                return error.details || error.message;
            }

            return 'Terminal error';
        };
    }, []);
    const { handleTerminalData } = useSocketTerminalSession({
        socketService,
        sessionKey: container._id,
        terminalRef,
        attachEvent: 'container:terminal:attach',
        attachPayload,
        detachEvent: 'container:terminal:detach',
        detachDelayMs: 100,
        dataEvent: 'container:terminal:data',
        errorEvent: 'container:error',
        inputEvent: 'container:terminal:input',
        resolveErrorMessage
    });

    useEffect(() => {
        if (!appendOutput?.data) return;
        terminalRef.current?.write(appendOutput.data);
    }, [appendOutput?.id, appendOutput?.data]);

    const content = (
        <Container className={`d-flex column overflow-hidden container-terminal-window ${embedded ? 'embedded' : ''}`}>
            {!embedded && (
                <Container className='d-flex content-between items-center container-terminal-header'>
                    <Container className='d-flex items-center gap-05 container-terminal-title'>
                        <span>root@{container.name}:~</span>
                    </Container>
                    <Tooltip content='Close Terminal' placement='bottom'>
                        <Button variant='ghost' intent='neutral' iconOnly size='sm' aria-label='Close terminal' title='Close terminal' onClick={onClose}>
                            <IoClose size={20} />
                        </Button>
                    </Tooltip>
                </Container>
            )}
            <Container className='flex-1 overflow-hidden p-relative container-terminal-body'>
                <Terminal ref={terminalRef} onData={handleTerminalData} />
            </Container>
        </Container>
    );

    if (embedded) return content;

    return (
        <Container className='p-fixed inset-0 d-flex items-center content-center container-terminal-overlay' role='dialog' aria-modal='true' aria-label={`Terminal for ${container.name}`}>
            {content}
        </Container>
    );
};

export default ContainerTerminal;
