import { filterPersistableAppState } from '@/modules/whiteboards/utilities/whiteboards';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import { useCallback, useEffect, useRef, useState } from 'react';

type ExcalidrawElement = Record<string, unknown>;
type AppState = Record<string, unknown>;

interface WhiteboardDeltaPayload {
    whiteboardId: string;
    elements: ExcalidrawElement[];
    appState: AppState;
    version: number;
    senderId?: string;
};

interface UseWhiteboardSyncProps {
    whiteboardId?: string;
    enabled?: boolean;
    hasPendingLocalChanges?: boolean;
    onRemoteDelta?: (elements: ExcalidrawElement[], appState: AppState) => void;
};

interface PendingWhiteboardDelta {
    elements: ExcalidrawElement[];
    appState: AppState;
    version: number;
};

/** Delta-broadcast debounce interval in ms (V1: last-write-wins) */
const DELTA_DEBOUNCE_MS = 80;

const useWhiteboardSync = ({
    whiteboardId,
    enabled = true,
    hasPendingLocalChanges = false,
    onRemoteDelta
}: UseWhiteboardSyncProps) => {
    const socketService = useSocket();
    const versionRef = useRef(0);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingRemoteDeltaRef = useRef<PendingWhiteboardDelta | null>(null);
    const [pendingRemoteDeltaVersion, setPendingRemoteDeltaVersion] = useState(0);

    const sendDelta = useCallback((elements: ExcalidrawElement[], appState: AppState) => {
        if (!enabled || !whiteboardId) {
            return;
        }

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            versionRef.current += 1;
            socketService.emit('whiteboard_delta', {
                whiteboardId,
                elements,
                appState: filterPersistableAppState(appState),
                version: versionRef.current
            }).catch(console.warn);
        }, DELTA_DEBOUNCE_MS);
    }, [enabled, whiteboardId, socketService]);

    const applyPendingRemoteDelta = useCallback(() => {
        const pendingDelta = pendingRemoteDeltaRef.current;
        if (!pendingDelta) {
            return;
        }

        pendingRemoteDeltaRef.current = null;
        setPendingRemoteDeltaVersion(0);
        versionRef.current = Math.max(versionRef.current, pendingDelta.version);
        onRemoteDelta?.(pendingDelta.elements, pendingDelta.appState);
    }, [onRemoteDelta]);

    const dismissPendingRemoteDelta = useCallback(() => {
        pendingRemoteDeltaRef.current = null;
        setPendingRemoteDeltaVersion(0);
    }, []);

    useEffect(() => {
        if (!enabled || !whiteboardId) {
            return;
        }

        const unsubscribeDelta = socketService.on<[WhiteboardDeltaPayload]>(
            'whiteboard_delta',
            (payload) => {
                if (!payload || payload.whiteboardId !== whiteboardId) {
                    return;
                }

                if (payload.version < versionRef.current) {
                    return;
                }

                if (hasPendingLocalChanges || debounceTimerRef.current) {
                    pendingRemoteDeltaRef.current = {
                        elements: payload.elements,
                        appState: payload.appState,
                        version: payload.version
                    };
                    setPendingRemoteDeltaVersion(payload.version);
                    return;
                }

                versionRef.current = Math.max(versionRef.current, payload.version);
                onRemoteDelta?.(payload.elements, payload.appState);
            }
        );

        return () => {
            unsubscribeDelta();
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [whiteboardId, enabled, hasPendingLocalChanges, socketService, onRemoteDelta]);

    return {
        sendDelta,
        hasPendingRemoteDelta: pendingRemoteDeltaVersion > 0,
        applyPendingRemoteDelta,
        dismissPendingRemoteDelta
    };
};

export default useWhiteboardSync;
