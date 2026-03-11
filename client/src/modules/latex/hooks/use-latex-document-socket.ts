import { create } from 'zustand';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import { useEffect, useRef, useCallback } from 'react';
import type { PresenceUser } from '@/modules/socket/trajectory/api/entities/presence-user';

interface LatexPresenceState {
    users: PresenceUser[];
};

interface LatexContentUpdatedPayload {
    documentId: string;
    content: string;
    timestamp: number;
    senderId: string;
};

interface UseLatexDocumentSocketProps {
    documentId?: string;
    teamId?: string;
    enabled?: boolean;
    onRemoteContentUpdate?: (content: string, timestamp: number) => void;
};

/** Debounce interval before emitting a content update over the socket. */
const CONTENT_DEBOUNCE_MS = 500;

const usePresenceStore = create<LatexPresenceState>(() => ({
    users: []
}));

const setPresenceUsers = (users: PresenceUser[]): void => {
    usePresenceStore.setState({ users });
};

/**
 * Manages real-time collaboration for a LaTeX document:
 * joining/leaving the document room, broadcasting content changes,
 * and receiving presence updates.
 */
const useLatexDocumentSocket = ({
    documentId,
    teamId,
    enabled = true,
    onRemoteContentUpdate
}: UseLatexDocumentSocketProps) => {
    const socketService = useSocket();
    const isConnectedRef = useRef(socketService.isConnected());
    const subscribedRef = useRef(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const users = usePresenceStore((state) => state.users);

    const subscribeToDocument = useCallback((): void => {
        if (!enabled || !documentId || !teamId || !isConnectedRef.current || subscribedRef.current) {
            return;
        }

        subscribedRef.current = true;
        socketService.emit('latex_open_document', { documentId, teamId }).catch(console.warn);
    }, [enabled, documentId, teamId, socketService]);

    useEffect(() => {
        const unsubscribe = socketService.onConnectionChange((connected) => {
            isConnectedRef.current = connected;
            if (connected && enabled && documentId && teamId && !subscribedRef.current) {
                subscribeToDocument();
            }
        });
        return unsubscribe;
    }, [enabled, documentId, teamId, socketService, subscribeToDocument]);

    useEffect(() => {
        if (!enabled || !documentId || !teamId) {
            return;
        }

        if (isConnectedRef.current) {
            subscribeToDocument();
        }

        const unsubscribeContent = socketService.on<[LatexContentUpdatedPayload]>(
            'latex_content_updated',
            (payload) => {
                if (!payload || payload.documentId !== documentId) {
                    return;
                }
                onRemoteContentUpdate?.(payload.content, payload.timestamp);
            }
        );

        const unsubscribePresence = socketService.on(
            'latex_users_update',
            (users) => setPresenceUsers(users as PresenceUser[])
        );

        return (): void => {
            subscribedRef.current = false;
            unsubscribeContent();
            unsubscribePresence();

            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }

            if (isConnectedRef.current) {
                socketService.emit('latex_close_document', { documentId }).catch(console.warn);
            }

            setPresenceUsers([]);
        };
    }, [documentId, teamId, enabled, subscribeToDocument, socketService, onRemoteContentUpdate]);

    const sendContentUpdate = useCallback((content: string): void => {
        if (!enabled || !documentId || !teamId) {
            return;
        }

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            debounceTimerRef.current = null;
            socketService.emit('latex_update_content', {
                documentId,
                teamId,
                content,
                timestamp: Date.now()
            }).catch(console.warn);
        }, CONTENT_DEBOUNCE_MS);
    }, [enabled, documentId, teamId, socketService]);

    return {
        collaborators: users,
        sendContentUpdate
    };
};

export default useLatexDocumentSocket;
