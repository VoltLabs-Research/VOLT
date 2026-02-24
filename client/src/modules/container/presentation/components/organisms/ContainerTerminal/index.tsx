import { useEffect, useRef } from 'react';
import { IoClose } from 'react-icons/io5';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Tooltip from '@/shared/presentation/components/Tooltip';
import Terminal, { type TerminalHandle } from '@/shared/presentation/components/Terminal';
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

const connectionState: Record<string, {
    count: number;
    isAttached: boolean;
    detachTimer: ReturnType<typeof setTimeout> | null;
}> = {};

export const ContainerTerminal = ({ container, onClose, embedded = false, appendOutput = null }: ContainerTerminalProps) => {
    const terminalRef = useRef<TerminalHandle>(null);
    const isAttachedRef = useRef(false);
    const socketService = useSocket();

    useEffect(() => {
        const id = container._id;
        if(!connectionState[id]){
            connectionState[id] = { count: 0, isAttached: false, detachTimer: null };
        }
        const state = connectionState[id];

        if(state.detachTimer){
            clearTimeout(state.detachTimer);
            state.detachTimer = null;
        }

        state.count++;
        socketService.connect();

        return () => {
            state.count--;
            if(state.count === 0){
                state.detachTimer = setTimeout(() => {
                    if(state.count === 0){
                        socketService.emit('container:terminal:detach');
                        state.isAttached = false;
                        isAttachedRef.current = false;
                        delete connectionState[id];
                    }
                }, 100);
            }
        };
    }, [container._id, socketService]);

    useEffect(() => {
        const id = container._id;
        const state = connectionState[id];

        const attach = () => {
            if(isAttachedRef.current || state.isAttached) return;
            if(socketService.isConnected()){
                socketService.emit('container:terminal:attach', { containerId: id });
                state.isAttached = true;
                isAttachedRef.current = true;
            }
        };

        const handleData = (data: string) => {
            terminalRef.current?.write(data);
        };

        const handleError = (error: string) => {
            terminalRef.current?.write(`\r\n\x1b[31mError: ${error}\x1b[0m\r\n`);
        };

        const unsubData = socketService.on('container:terminal:data', handleData as (...args: unknown[]) => void);
        const unsubError = socketService.on('container:error', handleError as (...args: unknown[]) => void);
        const unsubConnection = socketService.onConnectionChange((connected) => {
            if(connected && !isAttachedRef.current) attach();
        });

        if(socketService.isConnected()) attach();

        return () => {
            unsubData();
            unsubError();
            unsubConnection();
        };
    }, [container._id, socketService]);

    const handleTerminalData = (data: string) => {
        socketService.emit('container:terminal:input', data);
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
