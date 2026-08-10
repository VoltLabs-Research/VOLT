import { useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { useSocketTerminalSession } from '@/modules/socket/hooks/use-socket-terminal-session';
import { SOCKET_CONTAINER_TERMINAL_EVENTS } from '@/modules/socket/events/container';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import { Button, Tooltip } from '@heroui/react';
import Terminal from '@/shared/ui/components/Terminal';
import type { TerminalHandle } from '@/shared/ui/components/Terminal';
import type { Container } from '@volt/contracts/modules/container/domain';

/**
 * `ContainerTerminal.css`, converted.
 *
 * Two rules in it were already inert and are not carried over. The overlay's
 * `backdrop-filter: var(--glass-blur)` resolves to `none` — glass was flattened
 * onto solid surfaces before this migration and the token has been `none` ever
 * since. And the 768px arm's `border-radius: 0` had no radius to reset: the window
 * never declared one.
 *
 * `box-shadow: var(--shadow-elevated)` is HeroUI's `--overlay-shadow`, which is a
 * real custom property in `:root` (not folded into a utility), so it can be read
 * directly by an arbitrary shadow.
 */
const OVERLAY_CLASS_NAMES = 'fixed inset-0 z-[1000] flex items-center justify-center bg-overlay';
const WINDOW_CLASS_NAMES = 'flex flex-col overflow-hidden border border-border shadow-[var(--overlay-shadow)] w-[90vw] h-[80vh] max-[768px]:w-screen max-[768px]:h-[100dvh]';
const WINDOW_EMBEDDED_CLASS_NAMES = 'flex flex-col overflow-hidden w-full h-full border-none shadow-none';
const HEADER_CLASS_NAMES = 'flex flex-row items-center justify-between border border-border px-4 py-3';

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
        <div className={embedded ? WINDOW_EMBEDDED_CLASS_NAMES : WINDOW_CLASS_NAMES}>
            {!embedded && (
                <div className={HEADER_CLASS_NAMES}>
                    <div className='flex flex-row items-center gap-2 text-[0.9rem] text-foreground'>
                        <span>root@{container.name}:~</span>
                    </div>
                    {/*
                      * HeroUI's `Button` takes no `title`; the native tooltip that
                      * mirrored the aria-label is carried by the surrounding `Tooltip`.
                      */}
                    <Tooltip>
                        <Button variant='ghost' isIconOnly size='sm' aria-label='Close terminal' onPress={onClose}>
                            <X size={20} />
                        </Button>
                        <Tooltip.Content placement='bottom'>Close Terminal</Tooltip.Content>
                    </Tooltip>
                </div>
            )}
            <div className='relative flex-1 overflow-hidden'>
                <Terminal ref={terminalRef} onData={handleTerminalData} onResize={handleTerminalResize} />
            </div>
        </div>
    );

    if (embedded) return content;

    return (
        <div className={OVERLAY_CLASS_NAMES} role='dialog' aria-modal='true' aria-label={`Terminal for ${container.name}`}>
            {content}
        </div>
    );
};

export default ContainerTerminal;
