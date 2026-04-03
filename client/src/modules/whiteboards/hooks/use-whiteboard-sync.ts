import {
    computeWhiteboardSceneDelta,
    filterPersistableAppState,
    mergeWhiteboardAppState,
    mergeWhiteboardElements
} from '@/modules/whiteboards/utilities/whiteboards';
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
    elementOrder?: string[];
};

interface WhiteboardStatePayload {
    whiteboardId: string;
    revision: number;
    elements: ExcalidrawElement[];
    appState: AppState;
    elementOrder?: string[];
    senderId?: string;
    clientId?: string;
    baseRevision?: number;
};

interface QueuedWhiteboardState {
    elements: ExcalidrawElement[];
    appState: AppState;
};

interface SyncedWhiteboardState {
    elements: ExcalidrawElement[];
    appState: AppState;
};

interface UseWhiteboardSyncProps {
    whiteboardId?: string;
    enabled?: boolean;
    onRemoteState?: (
        elements: ExcalidrawElement[],
        appState: AppState,
        revision: number,
        elementOrder?: string[]
    ) => Promise<void> | void;
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
    const syncedSceneRef = useRef<SyncedWhiteboardState>({
        elements: [],
        appState: {}
    });

    const flushQueuedState = useCallback(() => {
        const queuedState = queuedStateRef.current;
        if (!queuedState || !enabled || !whiteboardId || !isConnectedRef.current || !isSubscribedRef.current || !hasSnapshotRef.current) {
            return;
        }

        const delta = computeWhiteboardSceneDelta(
            syncedSceneRef.current.elements,
            queuedState.elements,
            syncedSceneRef.current.appState,
            queuedState.appState
        );

        if (!delta.changed) {
            queuedStateRef.current = null;
            return;
        }

        queuedStateRef.current = null;

        const payload: WhiteboardPatchPayload = {
            whiteboardId,
            clientId: clientIdRef.current,
            baseRevision: revisionRef.current,
            elements: delta.elements,
            appState: delta.appState,
            elementOrder: delta.elementOrder
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

        const applyRemoteState = (
            payload: WhiteboardStatePayload,
            mode: 'snapshot' | 'delta'
        ) => {
            if (!payload || payload.whiteboardId !== whiteboardId) {
                return;
            }

            const isStalePayload = mode === 'snapshot'
                ? payload.revision < revisionRef.current
                : payload.revision <= revisionRef.current;

            if (isStalePayload) {
                return;
            }

            revisionRef.current = payload.revision;
            hasSnapshotRef.current = true;

            if (mode === 'snapshot') {
                syncedSceneRef.current = {
                    elements: payload.elements,
                    appState: filterPersistableAppState(payload.appState)
                };
            } else {
                syncedSceneRef.current = {
                    elements: mergeWhiteboardElements(
                        syncedSceneRef.current.elements,
                        payload.elements,
                        payload.elementOrder
                    ),
                    appState: mergeWhiteboardAppState(
                        syncedSceneRef.current.appState,
                        payload.appState
                    )
                };
            }

            remoteApplyChainRef.current = remoteApplyChainRef.current
                .catch(() => undefined)
                .then(async () => {
                    if (payload.clientId === clientIdRef.current && mode === 'delta') {
                        return;
                    }

                    const resolvedElementOrder = mode === 'snapshot'
                        ? payload.elements
                            .map((element) => element.id)
                            .filter((id): id is string => typeof id === 'string' && id.length > 0)
                        : payload.elementOrder;

                    await onRemoteState?.(
                        payload.elements,
                        payload.appState,
                        payload.revision,
                        resolvedElementOrder
                    );
                })
                .finally(() => {
                    flushQueuedState();
                });
        };

        const unsubscribeState = socketService.on<[WhiteboardStatePayload]>(
            'whiteboard_sync_state',
            (payload) => {
                applyRemoteState(payload, 'snapshot');
            }
        );

        const unsubscribeDelta = socketService.on<[WhiteboardStatePayload]>(
            'whiteboard_apply_delta',
            (payload) => {
                applyRemoteState(payload, 'delta');
            }
        );

        subscribeToWhiteboard();

        return () => {
            unsubscribeState();
            unsubscribeDelta();

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
            syncedSceneRef.current = {
                elements: [],
                appState: {}
            };
        };
    }, [enabled, flushQueuedState, onRemoteState, subscribeToWhiteboard, whiteboardId, socketService]);

    return {
        sendDelta,
        clientId: clientIdRef.current
    };
};

export default useWhiteboardSync;
