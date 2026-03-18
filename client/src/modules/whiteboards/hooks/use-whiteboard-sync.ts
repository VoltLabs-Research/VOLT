import { filterPersistableAppState } from '@/modules/whiteboards/utilities/whiteboards';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import { useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

type ExcalidrawElement = Record<string, unknown>;
type AppState = Record<string, unknown>;

interface WhiteboardPatchPayload {
    whiteboardId: string;
    clientId: string;
    baseRevision: number;
    elements: ExcalidrawElement[];
    appState: AppState;
};

interface WhiteboardStatePayload {
    whiteboardId: string;
    revision: number;
    elements: ExcalidrawElement[];
    appState: AppState;
    senderId?: string;
    clientId?: string;
};

interface QueuedWhiteboardState {
    elements: ExcalidrawElement[];
    appState: AppState;
};

interface UseWhiteboardSyncProps {
    whiteboardId?: string;
    enabled?: boolean;
    onRemoteState?: (elements: ExcalidrawElement[], appState: AppState, revision: number) => Promise<void> | void;
};

const DELTA_DEBOUNCE_MS = 80;

const useWhiteboardSync = ({
    whiteboardId,
    enabled = true,
    onRemoteState
}: UseWhiteboardSyncProps) => {
    const socketService = useSocket();
    const clientIdRef = useRef(uuidv4());
    const revisionRef = useRef(0);
    const isConnectedRef = useRef(socketService.isConnected());
    const isSubscribedRef = useRef(false);
    const hasSnapshotRef = useRef(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const queuedStateRef = useRef<QueuedWhiteboardState | null>(null);
    const remoteApplyChainRef = useRef(Promise.resolve());

    const flushQueuedState = useCallback(() => {
        const queuedState = queuedStateRef.current;
        if (!queuedState || !enabled || !whiteboardId || !isConnectedRef.current || !isSubscribedRef.current || !hasSnapshotRef.current) {
            return;
        }

        queuedStateRef.current = null;

        const payload: WhiteboardPatchPayload = {
            whiteboardId,
            clientId: clientIdRef.current,
            baseRevision: revisionRef.current,
            elements: queuedState.elements,
            appState: queuedState.appState
        };

        socketService.emit('whiteboard_patch', payload).catch(() => {
            queuedStateRef.current = queuedState;
        });
    }, [enabled, whiteboardId, socketService]);

    const subscribeToWhiteboard = useCallback(() => {
        if (!enabled || !whiteboardId || !isConnectedRef.current || isSubscribedRef.current) {
            return;
        }

        isSubscribedRef.current = true;
        hasSnapshotRef.current = false;
        socketService.emit('subscribe_to_whiteboard', { whiteboardId }).catch(() => {
            isSubscribedRef.current = false;
        });
    }, [enabled, whiteboardId, socketService]);

    const sendDelta = useCallback((elements: ExcalidrawElement[], appState: AppState) => {
        if (!enabled || !whiteboardId) {
            return;
        }

        queuedStateRef.current = {
            elements,
            appState: filterPersistableAppState(appState)
        };

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            debounceTimerRef.current = null;
            flushQueuedState();
        }, DELTA_DEBOUNCE_MS);
    }, [enabled, flushQueuedState, whiteboardId]);

    useEffect(() => {
        if (!enabled || !whiteboardId) {
            return;
        }

        const unsubscribeConnection = socketService.onConnectionChange((connected) => {
            isConnectedRef.current = connected;
            if (connected) {
                isSubscribedRef.current = false;
                subscribeToWhiteboard();
                return;
            }

            hasSnapshotRef.current = false;
        });

        socketService.connect().catch(() => undefined);

        return () => {
            unsubscribeConnection();
        };
    }, [enabled, subscribeToWhiteboard, whiteboardId, socketService]);

    useEffect(() => {
        if (!enabled || !whiteboardId) {
            return;
        }

        const unsubscribeState = socketService.on<[WhiteboardStatePayload]>(
            'whiteboard_sync_state',
            (payload) => {
                if (!payload || payload.whiteboardId !== whiteboardId || payload.revision < revisionRef.current) {
                    return;
                }

                revisionRef.current = payload.revision;
                hasSnapshotRef.current = true;
                remoteApplyChainRef.current = remoteApplyChainRef.current
                    .catch(() => undefined)
                    .then(() => onRemoteState?.(payload.elements, payload.appState, payload.revision))
                    .finally(() => {
                        flushQueuedState();
                    });
            }
        );

        subscribeToWhiteboard();

        return () => {
            unsubscribeState();

            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            if (isConnectedRef.current && isSubscribedRef.current) {
                socketService.emit('unsubscribe_from_whiteboard', { whiteboardId }).catch(() => undefined);
            }

            revisionRef.current = 0;
            isSubscribedRef.current = false;
            hasSnapshotRef.current = false;
            queuedStateRef.current = null;
        };
    }, [enabled, flushQueuedState, onRemoteState, subscribeToWhiteboard, whiteboardId, socketService]);

    return {
        sendDelta,
        clientId: clientIdRef.current
    };
};

export default useWhiteboardSync;
