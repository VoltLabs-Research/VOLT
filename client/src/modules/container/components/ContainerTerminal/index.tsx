import { useMemo, useRef } from 'react';
import { IoClose } from 'react-icons/io5';
import { useSocketTerminalSession } from '@/modules/socket/hooks/use-socket-terminal-session';
import { SOCKET_CONTAINER_TERMINAL_EVENTS } from '@/modules/socket/events/container';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import { Box, Button, Row, Stack, Tooltip } from '@voltstack/bravais';
import Terminal from '@/shared/ui/components/Terminal';
import type { TerminalHandle } from '@/shared/ui/components/Terminal';
import type { Container } from '@volt/contracts/modules/container/domain';
import './ContainerTerminal.css';

interface ContainerTerminalProps {
    container: Pick<Container, '_id' | 'name'>;
    onClose?: () => void;
    embedded?: boolean;
}

interface ContainerTerminalSocketError {
    code: string;
    message: string;
}

const TERMINAL_ERROR_MESSAGE_BY_CODE: Record<string, string> = {
    CONTAINER_NOT_FOUND: "This container no longer exists. It may have been deleted — go back to the containers list.",
    NO_CLUSTER: "This container isn't assigned to a cluster yet. Start or redeploy it, then reopen the terminal.",
    'Team::AccessDenied': "You don't have access to this container's team.",
    INVALID_PAYLOAD: 'Could not open a terminal for this container. Refresh the page and try again.',
    ATTACH_FAILED: "Couldn't attach a terminal. The container may not be running — start it, then try again.",
    STREAM_ERROR: 'Connection lost — refresh to reconnect.'
};

// The shared terminal session hook hands errors over as `unknown`; our server only
// ever emits ContainerTerminalSocketError on this channel.
const resolveTerminalErrorMessage = (error: unknown): string => {
    const { code, message } = error as ContainerTerminalSocketError;

    return TERMINAL_ERROR_MESSAGE_BY_CODE[code] ?? message;
};

const ContainerTerminal = ({ container, onClose, embedded = false }: ContainerTerminalProps) => {
    const terminalRef = useRef<TerminalHandle>(null);
    const attachPayload = useMemo(() => ({ containerId: container._id }), [container._id]);
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
        resolveErrorMessage: resolveTerminalErrorMessage
    });

    useSocketEvent<{ cols: number; rows: number }>(SOCKET_CONTAINER_TERMINAL_EVENTS.SIZE, (payload) => {
        terminalRef.current?.resize(payload.cols, payload.rows);
    });

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
            <Box className='container-terminal-body relative' flex='1' overflow='hidden'>
                <Terminal ref={terminalRef} onData={handleTerminalData} onResize={handleTerminalResize} />
            </Box>
        </Stack>
    );

    if (embedded) return content;

    return (
        <Box className='container-terminal-overlay fixed' display='flex' inset='0' align='center' justify='center' role='dialog' aria-modal='true' aria-label={`Terminal for ${container.name}`}>
            {content}
        </Box>
    );
};

export default ContainerTerminal;
