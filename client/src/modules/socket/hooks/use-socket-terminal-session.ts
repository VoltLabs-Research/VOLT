import { sileo } from 'sileo';
import { useCallback, useEffect, useRef } from 'react';
import useSocket from './use-socket';
import useSocketEvent from './use-socket-event';

import type { MutableRefObject } from 'react';
import type { TerminalHandle } from '@/shared/presentation/components/Terminal';

interface UseSocketTerminalSessionOptions<TAttachPayload> {
    attachEvent: string;
    attachPayload?: TAttachPayload;
    dataEvent: string;
    detachDelayMs?: number;
    detachEvent: string;
    detachPayload?: unknown;
    errorEvent: string;
    inputEvent: string;
    resizeEvent?: string;
    resolveErrorMessage?: (error: unknown) => string;
    sessionKey: string;
    terminalRef: MutableRefObject<TerminalHandle | null>;
    toastTitle?: string;
}

interface UseSocketTerminalSessionResult {
    handleTerminalData: (data: string) => void;
    handleTerminalResize: (cols: number, rows: number) => void;
}

export const useSocketTerminalSession = <TAttachPayload>({
    attachEvent,
    attachPayload,
    dataEvent,
    detachDelayMs = 0,
    detachEvent,
    detachPayload,
    errorEvent,
    inputEvent,
    resizeEvent,
    resolveErrorMessage,
    sessionKey,
    terminalRef,
    toastTitle = 'Terminal error'
}: UseSocketTerminalSessionOptions<TAttachPayload>): UseSocketTerminalSessionResult => {
    const socketService = useSocket();
    const isAttachedRef = useRef(false);
    const detachTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearDetachTimer = useCallback(() => {
        if (!detachTimerRef.current) {
            return;
        }

        clearTimeout(detachTimerRef.current);
        detachTimerRef.current = null;
    }, []);

    const detach = useCallback(() => {
        if (!isAttachedRef.current) {
            return;
        }

        socketService.emitWithoutAck(detachEvent, detachPayload);
        isAttachedRef.current = false;
    }, [detachEvent, detachPayload, socketService]);

    const attach = useCallback(() => {
        if (isAttachedRef.current || !socketService.isConnected()) {
            return;
        }

        socketService.emitWithoutAck(attachEvent, attachPayload);
        isAttachedRef.current = true;
    }, [attachEvent, attachPayload, socketService]);

    useSocketEvent<unknown>(dataEvent, (data) => {
        if (typeof data !== 'string') return;
        terminalRef.current?.write(data);
    });

    useSocketEvent<unknown>(errorEvent, (error) => {
        const description = resolveErrorMessage?.(error) ?? (
            typeof error === 'string'
                ? error
                : 'Terminal error'
        );

        terminalRef.current?.write(`\r\n\x1b[31mError: ${description}\x1b[0m\r\n`);
        sileo.error({
            title: toastTitle,
            description
        });
    });

    useEffect(() => {
        clearDetachTimer();
        socketService.connect().catch(() => undefined);

        return () => {
            clearDetachTimer();

            if (!isAttachedRef.current) {
                return;
            }

            if (detachDelayMs > 0) {
                detachTimerRef.current = setTimeout(() => {
                    detach();
                    detachTimerRef.current = null;
                }, detachDelayMs);
                return;
            }

            detach();
        };
    }, [clearDetachTimer, detach, detachDelayMs, sessionKey, socketService]);

    useEffect(() => {
        const unsubscribeConnection = socketService.onConnectionChange((connected) => {
            if (connected) {
                attach();
            }
        });

        if (socketService.isConnected()) {
            attach();
        }

        return unsubscribeConnection;
    }, [attach, socketService]);

    const handleTerminalData = useCallback((data: string) => {
        socketService.emitWithoutAck(inputEvent, data);
    }, [inputEvent, socketService]);

    const handleTerminalResize = useCallback((cols: number, rows: number) => {
        if (resizeEvent && isAttachedRef.current) {
            socketService.emitWithoutAck(resizeEvent, { cols, rows });
        }
    }, [resizeEvent, socketService]);

    return {
        handleTerminalData,
        handleTerminalResize
    };
};
