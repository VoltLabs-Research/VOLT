import {
    cloneWhiteboardAppState,
    cloneWhiteboardElements,
    computeWhiteboardSceneDelta,
    filterPersistableAppState,
    mergeWhiteboardAppState,
    mergeWhiteboardElements
} from '@/modules/whiteboards/utilities/whiteboards';
import useSocket from '@/modules/socket/hooks/use-socket';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import { SOCKET_WHITEBOARD_EVENTS } from '@/modules/socket/events/whiteboards';
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

interface SocketAck<TData> {
    ok: boolean;
    data?: TData;
    error?: string;
};

interface WhiteboardSubscribeAck {
    snapshot?: WhiteboardStatePayload | null;
};

interface WhiteboardPatchAck {
    accepted: boolean;
    revision: number;
    delta?: WhiteboardStatePayload;
    snapshot?: WhiteboardStatePayload;
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
    const hasSnapshotRef = useRef(false);
    const isSubscribedRef = useRef(false);
    const isSendingPatchRef = useRef(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const queuedStateRef = useRef<QueuedWhiteboardState | null>(null);
    const remoteApplyChainRef = useRef(Promise.resolve());
    const applyRemoteStateRef = useRef<(
        payload: WhiteboardStatePayload | undefined,
        mode: 'snapshot' | 'delta'
    ) => void>(() => undefined);
    const syncedSceneRef = useRef<SyncedWhiteboardState>({
        elements: [],
        appState: {}
    });

    const subscriptionEnabled = enabled && !!whiteboardId;

    const readAckData = useCallback(<TData,>(ack: SocketAck<TData> | undefined, fallbackMessage: string): TData => {
        if (!ack?.ok || !ack.data) {
            throw new Error(ack?.error ?? fallbackMessage);
        }

        return ack.data;
    }, []);

    const applyPatchAck = useCallback((ack: WhiteboardPatchAck, sentState: QueuedWhiteboardState) => {
        if (ack.snapshot) {
            return;
        }

        if (ack.revision > revisionRef.current) {
            revisionRef.current = ack.revision;
        }

        if (ack.accepted) {
            hasSnapshotRef.current = true;
            syncedSceneRef.current = {
                elements: cloneWhiteboardElements(sentState.elements),
                appState: cloneWhiteboardAppState(filterPersistableAppState(sentState.appState))
            };
        }
    }, []);

    const flushQueuedState = useCallback(() => {
        const queuedState = queuedStateRef.current;
        if (
            !queuedState
            || !enabled
            || !whiteboardId
            || !socketService.isConnected()
            || !hasSnapshotRef.current
            || !isSubscribedRef.current
            || isSendingPatchRef.current
        ) {
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
        isSendingPatchRef.current = true;

        const payload: WhiteboardPatchPayload = {
            whiteboardId,
            clientId: clientIdRef.current,
            baseRevision: revisionRef.current,
            elements: delta.elements,
            appState: delta.appState,
            elementOrder: delta.elementOrder
        };

        socketService.emit<SocketAck<WhiteboardPatchAck>>(SOCKET_WHITEBOARD_EVENTS.PATCH, payload)
            .then((ack) => {
                const data = readAckData(ack, 'Whiteboard patch was not accepted.');
                if (data.snapshot) {
                    if (!data.accepted) {
                        queuedStateRef.current = queuedState;
                    }
                    applyRemoteStateRef.current(data.snapshot, 'snapshot');
                    return;
                }

                applyPatchAck(data, queuedState);
            })
            .catch(() => {
                queuedStateRef.current = queuedState;
            })
            .finally(() => {
                isSendingPatchRef.current = false;
                flushQueuedState();
            });
    }, [applyPatchAck, enabled, readAckData, whiteboardId, socketService]);

    const sendDelta = useCallback((elements: ExcalidrawElement[], appState: AppState) => {
        if (!enabled || !whiteboardId) {
            return;
        }

        queuedStateRef.current = {
            elements: cloneWhiteboardElements(elements),
            appState: cloneWhiteboardAppState(filterPersistableAppState(appState))
        };

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            debounceTimerRef.current = null;
            flushQueuedState();
        }, DELTA_DEBOUNCE_MS);
    }, [enabled, flushQueuedState, whiteboardId]);

    const applyRemoteState = useCallback((
        payload: WhiteboardStatePayload | undefined,
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
                elements: cloneWhiteboardElements(payload.elements),
                appState: cloneWhiteboardAppState(filterPersistableAppState(payload.appState))
            };
        } else {
            syncedSceneRef.current = {
                elements: cloneWhiteboardElements(mergeWhiteboardElements(
                    syncedSceneRef.current.elements,
                    payload.elements,
                    payload.elementOrder
                )),
                appState: cloneWhiteboardAppState(mergeWhiteboardAppState(
                    syncedSceneRef.current.appState,
                    payload.appState
                ))
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
    }, [whiteboardId, onRemoteState, flushQueuedState]);

    applyRemoteStateRef.current = applyRemoteState;

    useSocketEvent<WhiteboardStatePayload | undefined>(
        SOCKET_WHITEBOARD_EVENTS.SYNC_STATE,
        (payload) => applyRemoteState(payload, 'snapshot'),
        { enabled: subscriptionEnabled }
    );

    useSocketEvent<WhiteboardStatePayload | undefined>(
        SOCKET_WHITEBOARD_EVENTS.APPLY_DELTA,
        (payload) => applyRemoteState(payload, 'delta'),
        { enabled: subscriptionEnabled }
    );

    useEffect(() => {
        if (!subscriptionEnabled || !whiteboardId) return;

        let cancelled = false;

        const subscribe = async (): Promise<void> => {
            try {
                await socketService.connect();
                if (cancelled || !socketService.isConnected()) {
                    return;
                }

                const ack = await socketService.emit<SocketAck<WhiteboardSubscribeAck>>(
                    SOCKET_WHITEBOARD_EVENTS.SUBSCRIBE,
                    { whiteboardId }
                );

                if (cancelled) {
                    return;
                }

                const data = readAckData(ack, 'Whiteboard subscription failed.');
                isSubscribedRef.current = true;
                if (data.snapshot) {
                    applyRemoteState(data.snapshot, 'snapshot');
                }
                flushQueuedState();
            } catch {
                isSubscribedRef.current = false;
                hasSnapshotRef.current = false;
            }
        };

        subscribe();

        const unsubscribeConnection = socketService.onConnectionChange((connected) => {
            if (!connected) {
                isSubscribedRef.current = false;
                hasSnapshotRef.current = false;
                return;
            }

            subscribe();
        });

        return () => {
            cancelled = true;
            unsubscribeConnection();
            isSubscribedRef.current = false;
            hasSnapshotRef.current = false;

            if (socketService.isConnected()) {
                socketService.emitWithoutAck(SOCKET_WHITEBOARD_EVENTS.UNSUBSCRIBE, { whiteboardId });
            }
        };
    }, [applyRemoteState, flushQueuedState, readAckData, socketService, subscriptionEnabled, whiteboardId]);

    useEffect(() => {
        if (!subscriptionEnabled) return;

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            revisionRef.current = 0;
            hasSnapshotRef.current = false;
            queuedStateRef.current = null;
            syncedSceneRef.current = {
                elements: [],
                appState: {}
            };
        };
    }, [subscriptionEnabled, whiteboardId]);

    return {
        sendDelta,
        clientId: clientIdRef.current
    };
};

export default useWhiteboardSync;
