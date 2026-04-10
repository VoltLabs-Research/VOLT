import useSocket from '@/modules/socket/core/hooks/use-socket';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PresenceUser } from '@/modules/socket/trajectory/api/entities/presence-user';

interface CollaborativeContentUpdatedPayload {
    content: string;
    timestamp: number;
    senderId?: string;
}

interface UseCollaborativeDocumentSocketProps<
    TOpenPayload extends Record<string, unknown>,
    TClosePayload extends Record<string, unknown>,
    TContentPayload extends CollaborativeContentUpdatedPayload
> {
    enabled?: boolean;
    openEvent: string;
    closeEvent: string;
    contentUpdatedEvent: string;
    presenceUpdatedEvent: string;
    buildOpenPayload: () => TOpenPayload | null;
    buildClosePayload: () => TClosePayload | null;
    matchesContentPayload: (payload: unknown) => payload is TContentPayload;
    onRemoteContentUpdate?: (payload: TContentPayload) => void;
    contentDebounceMs?: number;
}

interface UseCollaborativeDocumentSocketResult<TSendPayload extends { eventName: string }> {
    collaborators: PresenceUser[];
    sendContentUpdate: (payload: TSendPayload) => void;
}

const DEFAULT_CONTENT_DEBOUNCE_MS = 500;

const useCollaborativeDocumentSocket = <
    TOpenPayload extends Record<string, unknown>,
    TClosePayload extends Record<string, unknown>,
    TContentPayload extends CollaborativeContentUpdatedPayload,
    TSendPayload extends { eventName: string }
>({
    enabled = true,
    openEvent,
    closeEvent,
    contentUpdatedEvent,
    presenceUpdatedEvent,
    buildOpenPayload,
    buildClosePayload,
    matchesContentPayload,
    onRemoteContentUpdate,
    contentDebounceMs = DEFAULT_CONTENT_DEBOUNCE_MS
}: UseCollaborativeDocumentSocketProps<TOpenPayload, TClosePayload, TContentPayload>): UseCollaborativeDocumentSocketResult<TSendPayload> => {
    const socketService = useSocket();
    const [collaborators, setCollaborators] = useState<PresenceUser[]>([]);
    const isConnectedRef = useRef(socketService.isConnected());
    const subscribedRef = useRef(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const buildOpenPayloadRef = useRef(buildOpenPayload);
    const buildClosePayloadRef = useRef(buildClosePayload);
    const matchesContentPayloadRef = useRef(matchesContentPayload);
    const onRemoteContentUpdateRef = useRef(onRemoteContentUpdate);

    useEffect(() => {
        buildOpenPayloadRef.current = buildOpenPayload;
        buildClosePayloadRef.current = buildClosePayload;
        matchesContentPayloadRef.current = matchesContentPayload;
        onRemoteContentUpdateRef.current = onRemoteContentUpdate;
    }, [buildClosePayload, buildOpenPayload, matchesContentPayload, onRemoteContentUpdate]);

    const subscribe = useCallback(() => {
        if (!enabled || !isConnectedRef.current || subscribedRef.current) {
            return;
        }

        const payload = buildOpenPayloadRef.current();
        if (!payload) {
            return;
        }

        subscribedRef.current = true;
        socketService.emit(openEvent, payload).catch(console.warn);
    }, [enabled, openEvent, socketService]);

    useEffect(() => {
        const unsubscribe = socketService.onConnectionChange((connected) => {
            isConnectedRef.current = connected;

            if (connected && !subscribedRef.current) {
                subscribe();
            }
        });

        return unsubscribe;
    }, [socketService, subscribe]);

    useEffect(() => {
        if (!enabled) {
            setCollaborators([]);
            return;
        }

        if (isConnectedRef.current) {
            subscribe();
        }

        const unsubscribeContent = socketService.on(contentUpdatedEvent, (payload) => {
            if (!matchesContentPayloadRef.current(payload)) {
                return;
            }

            onRemoteContentUpdateRef.current?.(payload);
        });

        const unsubscribePresence = socketService.on(presenceUpdatedEvent, (users) => {
            setCollaborators(Array.isArray(users) ? users as PresenceUser[] : []);
        });

        return () => {
            subscribedRef.current = false;
            unsubscribeContent();
            unsubscribePresence();

            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }

            const closePayload = buildClosePayloadRef.current();
            if (isConnectedRef.current && closePayload) {
                socketService.emit(closeEvent, closePayload).catch(console.warn);
            }

            setCollaborators([]);
        };
    }, [
        closeEvent,
        contentUpdatedEvent,
        enabled,
        presenceUpdatedEvent,
        socketService,
        subscribe
    ]);

    const sendContentUpdate = useCallback((payload: TSendPayload) => {
        if (!enabled) {
            return;
        }

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            debounceTimerRef.current = null;
            socketService.emit(payload.eventName, payload).catch(console.warn);
        }, contentDebounceMs);
    }, [contentDebounceMs, enabled, socketService]);

    return {
        collaborators,
        sendContentUpdate
    };
};

export default useCollaborativeDocumentSocket;
