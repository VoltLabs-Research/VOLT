import useSocketRoom from '@/modules/socket/hooks/use-socket-room';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import useThrottledSocketEmit from '@/modules/socket/hooks/use-throttled-socket-emit';
import { SOCKET_LATEX_EVENTS } from '@/modules/socket/events/latex';
import { useCallback, useState } from 'react';
import type { PresenceUser } from '@/modules/socket/types/presence-user';

const CONTENT_DEBOUNCE_MS = 500;

interface LatexContentUpdatedPayload {
    documentId: string;
    fileId: string;
    content: string;
    timestamp: number;
    senderId: string;
};

interface LatexContentUpdatePayload {
    documentId: string;
    teamId: string;
    fileId: string;
    content: string;
    timestamp: number;
};

interface UseLatexDocumentSocketProps {
    documentId?: string;
    teamId?: string;
    enabled?: boolean;
    onRemoteContentUpdate?: (content: string, timestamp: number, fileId: string) => void;
};

const isLatexContentUpdatedPayload = (
    value: unknown,
    documentId?: string
): value is LatexContentUpdatedPayload => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<LatexContentUpdatedPayload>;
    return candidate.documentId === documentId
        && typeof candidate.fileId === 'string'
        && typeof candidate.content === 'string'
        && typeof candidate.timestamp === 'number';
};

const useLatexDocumentSocket = ({
    documentId,
    teamId,
    enabled = true,
    onRemoteContentUpdate
}: UseLatexDocumentSocketProps) => {
    const isActive = enabled && !!documentId && !!teamId;
    const [collaborators, setCollaborators] = useState<PresenceUser[]>([]);

    useSocketRoom({
        joinEvent: SOCKET_LATEX_EVENTS.OPEN,
        leaveEvent: SOCKET_LATEX_EVENTS.CLOSE,
        roomKey: isActive ? documentId ?? null : null,
        buildJoinPayload: () => (documentId && teamId) ? { documentId, teamId } : null,
        buildLeavePayload: () => documentId ? { documentId } : null,
        enabled: isActive,
        fireAndForget: false
    });

    useSocketEvent<unknown>(SOCKET_LATEX_EVENTS.CONTENT_UPDATED, (payload) => {
        if (!isLatexContentUpdatedPayload(payload, documentId)) return;
        onRemoteContentUpdate?.(payload.content, payload.timestamp, payload.fileId);
    }, { enabled: isActive });

    useSocketEvent<unknown>(SOCKET_LATEX_EVENTS.USERS_UPDATE, (users) => {
        setCollaborators(Array.isArray(users) ? users as PresenceUser[] : []);
    }, { enabled: isActive });

    const contentEmitter = useThrottledSocketEmit<LatexContentUpdatePayload>(SOCKET_LATEX_EVENTS.UPDATE_CONTENT, {
        intervalMs: CONTENT_DEBOUNCE_MS,
        mode: 'debounce',
        enabled: isActive,
        fireAndForget: false
    });

    const sendContentUpdate = useCallback((content: string, fileId: string): void => {
        if (!isActive || !documentId || !teamId) {
            return;
        }

        contentEmitter.emit({
            documentId,
            teamId,
            fileId,
            content,
            timestamp: Date.now()
        });
    }, [contentEmitter, documentId, isActive, teamId]);

    return {
        collaborators,
        sendContentUpdate
    };
};

export default useLatexDocumentSocket;
