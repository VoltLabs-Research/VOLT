import { useEffect, useRef } from 'react';
import { IoClose } from 'react-icons/io5';
import useSocket from '@/modules/socket/hooks/use-socket';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Tooltip from '@/shared/presentation/components/Tooltip';
import Terminal, { type TerminalHandle } from '@/shared/presentation/components/Terminal';
import { sileo } from 'sileo';
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

interface TerminalConnectionState {
    isAttached: boolean;
    detachTimer: ReturnType<typeof setTimeout> | null;
}

interface ContainerTerminalSocketError {
    code: string;
    message: string;
    details?: string;
}

export const ContainerTerminal = ({ container, onClose, embedded = false, appendOutput = null }: ContainerTerminalProps) => {
    const terminalRef = useRef<TerminalHandle>(null);
    const isAttachedRef = useRef(false);
    const socketService = useSocket();
    const connectionStateRef = useRef<TerminalConnectionState>({
        isAttached: false,
        detachTimer: null
    });

    useEffect(() => {
        const connectionState = connectionStateRef.current;

        if (connectionState.detachTimer) {
            clearTimeout(connectionState.detachTimer);
            connectionState.detachTimer = null;
        }

        void socketService.connect().catch(() => undefined);

        return () => {
            if (connectionState.detachTimer) {
                clearTimeout(connectionState.detachTimer);
            }

            connectionState.detachTimer = setTimeout(() => {
                if (!connectionState.isAttached) {
                    connectionState.detachTimer = null;
                    return;
                }

                void socketService.emit('container:terminal:detach').catch(() => undefined);
                connectionState.isAttached = false;
                isAttachedRef.current = false;
                connectionState.detachTimer = null;
            }, 100);
        };
    }, [container._id, socketService]);

    useEffect(() => {
        const id = container._id;
        const connectionState = connectionStateRef.current;

        const attach = () => {
            if (isAttachedRef.current || connectionState.isAttached) {
                return;
            }

            if (!socketService.isConnected()) {
                return;
            }

            void socketService.emit('container:terminal:attach', { containerId: id }).catch(() => undefined);
            connectionState.isAttached = true;
            isAttachedRef.current = true;
        };

        const handleData = (data: string) => {
            terminalRef.current?.write(data);
        };

        const handleError = (error: string | ContainerTerminalSocketError) => {
            const description: string = typeof error === 'string'
                ? error
                : (error.details || error.message);

            terminalRef.current?.write(`\r\n\x1b[31mError: ${description}\x1b[0m\r\n`);
            sileo.error({ title: 'Terminal error', description });
        };

        const unsubData = socketService.on('container:terminal:data', handleData as (...args: unknown[]) => void);
        const unsubError = socketService.on('container:error', handleError as (...args: unknown[]) => void);
        const unsubConnection = socketService.onConnectionChange((connected) => {
            if(connected && !isAttachedRef.current) attach();
        });

        if(socketService.isConnected()) {
            attach();
        }

        return () => {
            unsubData();
            unsubError();
            unsubConnection();
        };
    }, [container._id, socketService]);

    const handleTerminalData = (data: string) => {
        void socketService.emit('container:terminal:input', data).catch(() => undefined);
    };

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
                        <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={onClose}>
                            <IoClose size={20} />
                        </Button>
                    </Tooltip>
                </Container>
            )}
            <Container className='flex-1 overflow-hidden p-relative container-terminal-body p-1'>
                <Terminal ref={terminalRef} onData={handleTerminalData} />
            </Container>
        </Container>
    );

    if(embedded) return content;

    return (
        <Container className='p-fixed inset-0 d-flex items-center content-center container-terminal-overlay'>
            {content}
        </Container>
    );
};

export default ContainerTerminal;
