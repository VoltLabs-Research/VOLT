import useSocket from './use-socket';
import { socketErrorReporter } from '../services/socket-error-reporter';
import { useEffect, useMemo, useRef } from 'react';

export type ThrottledEmitMode = 'leading-throttle' | 'trailing-throttle' | 'debounce';

interface UseThrottledSocketEmitOptions {
    intervalMs: number;
    mode?: ThrottledEmitMode;
    enabled?: boolean;
    fireAndForget?: boolean;
    /** Whether to flush a pending payload on unmount. Defaults to false (cancel). */
    flushOnUnmount?: boolean;
};

export interface ThrottledEmitter<TPayload> {
    emit: (payload: TPayload) => void;
    flush: () => void;
    cancel: () => void;
};

const useThrottledSocketEmit = <TPayload>(
    event: string,
    options: UseThrottledSocketEmitOptions
): ThrottledEmitter<TPayload> => {
    const {
        intervalMs,
        mode = 'leading-throttle',
        enabled = true,
        fireAndForget = true,
        flushOnUnmount = false
    } = options;

    const socketService = useSocket();
    const lastEmitAtRef = useRef(0);
    const pendingPayloadRef = useRef<TPayload | null>(null);
    const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const enabledRef = useRef(enabled);
    const eventRef = useRef(event);
    const fireAndForgetRef = useRef(fireAndForget);
    const flushOnUnmountRef = useRef(flushOnUnmount);

    enabledRef.current = enabled;
    eventRef.current = event;
    fireAndForgetRef.current = fireAndForget;
    flushOnUnmountRef.current = flushOnUnmount;

    const emitter = useMemo<ThrottledEmitter<TPayload>>(() => {
        const performEmit = (payload: TPayload): void => {
            if (fireAndForgetRef.current) {
                socketService.emitWithoutAck(eventRef.current, payload);
                return;
            }

            socketService.emit(eventRef.current, payload).catch((error) => {
                socketErrorReporter.report(error, { kind: 'emit', event: eventRef.current });
            });
        };

        const clearTrailingTimer = (): void => {
            if (trailingTimerRef.current !== null) {
                clearTimeout(trailingTimerRef.current);
                trailingTimerRef.current = null;
            }
        };

        const scheduleTrailing = (): void => {
            if (trailingTimerRef.current !== null) return;

            const elapsed = Date.now() - lastEmitAtRef.current;
            const delay = mode === 'debounce'
                ? intervalMs
                : Math.max(0, intervalMs - elapsed);

            trailingTimerRef.current = setTimeout(() => {
                trailingTimerRef.current = null;
                const queued = pendingPayloadRef.current;
                if (queued === null || queued === undefined) return;

                pendingPayloadRef.current = null;
                lastEmitAtRef.current = Date.now();
                performEmit(queued);
            }, delay);
        };

        return {
            emit(payload: TPayload) {
                if (!enabledRef.current) return;

                if (mode === 'leading-throttle') {
                    const now = Date.now();
                    if (now - lastEmitAtRef.current < intervalMs) return;
                    lastEmitAtRef.current = now;
                    performEmit(payload);
                    return;
                }

                if (mode === 'debounce') {
                    pendingPayloadRef.current = payload;
                    clearTrailingTimer();
                    scheduleTrailing();
                    return;
                }

                pendingPayloadRef.current = payload;
                scheduleTrailing();
            },
            flush() {
                clearTrailingTimer();
                const queued = pendingPayloadRef.current;
                if (queued === null || queued === undefined) return;

                pendingPayloadRef.current = null;
                lastEmitAtRef.current = Date.now();
                performEmit(queued);
            },
            cancel() {
                clearTrailingTimer();
                pendingPayloadRef.current = null;
            }
        };
    }, [socketService, intervalMs, mode]);

    useEffect(() => {
        return () => {
            if (flushOnUnmountRef.current) {
                emitter.flush();
            } else {
                emitter.cancel();
            }
        };
    }, [emitter]);

    return emitter;
};

export default useThrottledSocketEmit;
