import { useEffect, useRef, useCallback } from 'react';
import useSocket from '@/modules/socket/core/hooks/use-socket';

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
    onRemoteDelta?: (elements: ExcalidrawElement[], appState: AppState) => void;
};

/** Delta-broadcast debounce interval in ms (V1: last-write-wins) */
const DELTA_DEBOUNCE_MS = 80;

const useWhiteboardSync = ({ whiteboardId, enabled = true, onRemoteDelta }: UseWhiteboardSyncProps) => {
    const socketService = useSocket();
    const versionRef = useRef(0);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
                appState,
                version: versionRef.current
            }).catch(console.warn);
        }, DELTA_DEBOUNCE_MS);
    }, [enabled, whiteboardId, socketService]);

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

                onRemoteDelta?.(payload.elements, payload.appState);
            }
        );

        return () => {
            unsubscribeDelta();
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [whiteboardId, enabled, socketService, onRemoteDelta]);

    return { sendDelta };
};

export default useWhiteboardSync;
