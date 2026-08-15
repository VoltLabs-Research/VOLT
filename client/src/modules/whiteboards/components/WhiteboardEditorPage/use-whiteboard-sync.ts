import {
    cloneWhiteboardAppState,
    cloneWhiteboardElements,
    computeWhiteboardSceneDelta,
    filterPersistableAppState,
    mergeWhiteboardAppState,
    mergeWhiteboardElements
} from '@/modules/whiteboards/utils/whiteboards';
import useSocket from '@/modules/socket/hooks/use-socket';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import { SOCKET_WHITEBOARD_EVENTS } from '@/modules/socket/events/whiteboards';
import type { SocketAck } from '@/modules/socket/contracts/socket-service';
import type {
    WhiteboardAppState,
    WhiteboardElements,
    WhiteboardScene,
    WhiteboardScenePayload
} from '@/modules/whiteboards/contracts/excalidraw';
import { useCallback, useEffect, useRef } from 'react';
import { sileo } from 'sileo';
import { v4 as uuidv4 } from 'uuid';

interface WhiteboardPatchPayload extends WhiteboardScene {
    whiteboardId: string;
    clientId: string;
    baseRevision: number;
    elementOrder?: string[];
};

interface WhiteboardSubscribeAck {
    snapshot?: WhiteboardScenePayload | null;
};

interface WhiteboardPatchAck {
    accepted: boolean;
    revision: number;
    snapshot?: WhiteboardScenePayload;
};

interface UseWhiteboardSyncProps {
    whiteboardId?: string;
    enabled?: boolean;
    onRemoteState?: (
        elements: WhiteboardElements,
        appState: WhiteboardAppState,
        elementOrder?: string[]
    ) => Promise<void> | void;
};

const DELTA_DEBOUNCE_MS = 80;

const CONFLICT_TOAST_THROTTLE_MS = 5000;

const readAckData = <TData,>(ack: SocketAck<TData>, fallbackMessage: string): TData => {
    if (!ack.ok || !ack.data) {
        throw new Error(ack.error ?? fallbackMessage);
    }

    return ack.data;
};

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
    const queuedStateRef = useRef<WhiteboardScene | null>(null);
    const remoteApplyChainRef = useRef(Promise.resolve());
    const lastConflictToastAtRef = useRef(0);
    const applyRemoteStateRef = useRef<(
        payload: WhiteboardScenePayload,
        mode: 'snapshot' | 'delta'
    ) => void>(() => undefined);
    const syncedSceneRef = useRef<WhiteboardScene>({
        elements: [],
        appState: {}
    });

    const subscriptionEnabled = enabled && !!whiteboardId;

    const applyPatchAck = useCallback((ack: WhiteboardPatchAck, sentState: WhiteboardScene) => {
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

    const notifyConflictSync = useCallback(() => {
        const now = Date.now();
        if (now - lastConflictToastAtRef.current < CONFLICT_TOAST_THROTTLE_MS) {
            return;
        }

        lastConflictToastAtRef.current = now;
        sileo.info({ title: 'Canvas synced — someone else was editing at the same time.' });
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
                    notifyConflictSync();
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
    }, [applyPatchAck, enabled, notifyConflictSync, whiteboardId, socketService]);

    const sendDelta = useCallback((elements: WhiteboardElements, appState: WhiteboardAppState) => {
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
        payload: WhiteboardScenePayload,
        mode: 'snapshot' | 'delta'
    ) => {
        if (payload.whiteboardId !== whiteboardId) {
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
                    ? payload.elements.map((element) => element.id)
                    : payload.elementOrder;

                await onRemoteState?.(payload.elements, payload.appState, resolvedElementOrder);
            })
            .finally(() => {
                flushQueuedState();
            });
    }, [whiteboardId, onRemoteState, flushQueuedState]);

    applyRemoteStateRef.current = applyRemoteState;

    useSocketEvent<WhiteboardScenePayload>(
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
    }, [applyRemoteState, flushQueuedState, socketService, subscriptionEnabled, whiteboardId]);

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

    return { sendDelta };
};

export default useWhiteboardSync;
