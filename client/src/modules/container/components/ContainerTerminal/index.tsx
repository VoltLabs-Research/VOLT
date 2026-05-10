import { useEffect, useMemo, useRef } from 'react';
import { IoClose } from 'react-icons/io5';
import { useSocketTerminalSession } from '@/modules/socket/hooks/use-socket-terminal-session';
import { SOCKET_CONTAINER_TERMINAL_EVENTS } from '@/modules/socket/events/container';
import Box from '@/shared/presentation/primitives/Box';
import Button from '@/shared/presentation/primitives/Button';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Tooltip from '@/shared/presentation/primitives/Tooltip';
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
}

interface ContainerTerminalSocketError {
    code: string;
    message: string;
    details?: string;
}

const isContainerTerminalSocketError = (value: unknown): value is ContainerTerminalSocketError => {
    return typeof value === 'object' && value !== null && 'message' in value && 'code' in value;
};

const ContainerTerminal = ({ container, onClose, embedded = false, appendOutput = null }: ContainerTerminalProps) => {
    const terminalRef = useRef<TerminalHandle>(null);
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
    const { handleTerminalData, handleTerminalResize } = useSocketTerminalSession({
        sessionKey: container._id,
        terminalRef,
        attachEvent: SOCKET_CONTAINER_TERMINAL_EVENTS.ATTACH,
        attachPayload,
        detachEvent: SOCKET_CONTAINER_TERMINAL_EVENTS.DETACH,
        detachDelayMs: 100,
        dataEvent: SOCKET_CONTAINER_TERMINAL_EVENTS.DATA,
        errorEvent: SOCKET_CONTAINER_TERMINAL_EVENTS.ERROR,
        inputEvent: SOCKET_CONTAINER_TERMINAL_EVENTS.INPUT,
        resizeEvent: SOCKET_CONTAINER_TERMINAL_EVENTS.RESIZE,
        resolveErrorMessage
    });

    useEffect(() => {
        if (!appendOutput?.data) return;
        terminalRef.current?.write(appendOutput.data);
    }, [appendOutput?.id, appendOutput?.data]);

    const content = (
        <Stack className={`container-terminal-window ${embedded ? 'embedded' : ''}`} overflow='hidden'>
            {!embedded && (
                <Row className='container-terminal-header' justify='between'>
                    <Row className='container-terminal-title' gap='05'>
                        <span>root@{container.name}:~</span>
                    </Row>
                    <Tooltip content='Close Terminal' placement='bottom'>
                        <Button variant='ghost' intent='neutral' iconOnly size='sm' aria-label='Close terminal' title='Close terminal' onClick={onClose}>
                            <IoClose size={20} />
                        </Button>
                    </Tooltip>
                </Row>
            )}
            <Box className='container-terminal-body p-relative' flex='1' overflow='hidden'>
                <Terminal ref={terminalRef} onData={handleTerminalData} onResize={handleTerminalResize} />
            </Box>
        </Stack>
    );

    if (embedded) return content;

    return (
        <Box className='container-terminal-overlay p-fixed' display='flex' inset='0' align='center' justify='center' role='dialog' aria-modal='true' aria-label={`Terminal for ${container.name}`}>
            {content}
        </Box>
    );
};

export default ContainerTerminal;
