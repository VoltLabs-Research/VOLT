import useCollaborativeDocumentSocket from '@/modules/socket/core/hooks/use-collaborative-document-socket';
import { useCallback } from 'react';

interface LatexContentUpdatedPayload {
    documentId: string;
    /** ID of the LatexFile that was updated. */
    fileId: string;
    content: string;
    timestamp: number;
    senderId: string;
};

interface UseLatexDocumentSocketProps {
    documentId?: string;
    teamId?: string;
    enabled?: boolean;
    onRemoteContentUpdate?: (content: string, timestamp: number, fileId: string) => void;
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
    const { collaborators, sendContentUpdate: scheduleContentUpdate } = useCollaborativeDocumentSocket<
        { documentId: string; teamId: string },
        { documentId: string },
        LatexContentUpdatedPayload,
        {
            eventName: 'latex_update_content';
            documentId: string;
            teamId: string;
            fileId: string;
            content: string;
            timestamp: number;
        }
    >({
        enabled: enabled && Boolean(documentId) && Boolean(teamId),
        openEvent: 'latex_open_document',
        closeEvent: 'latex_close_document',
        contentUpdatedEvent: 'latex_content_updated',
        presenceUpdatedEvent: 'latex_users_update',
        buildOpenPayload: () => {
            if (!documentId || !teamId) {
                return null;
            }

            return {
                documentId,
                teamId
            };
        },
        buildClosePayload: () => {
            if (!documentId) {
                return null;
            }

            return { documentId };
        },
        matchesContentPayload: (payload): payload is LatexContentUpdatedPayload => {
            if (!payload || typeof payload !== 'object') {
                return false;
            }

            const value = payload as Partial<LatexContentUpdatedPayload>;
            return value.documentId === documentId
                && typeof value.fileId === 'string'
                && typeof value.content === 'string'
                && typeof value.timestamp === 'number';
        },
        onRemoteContentUpdate: (payload) => {
            onRemoteContentUpdate?.(payload.content, payload.timestamp, payload.fileId);
        }
    });

    const sendContentUpdate = useCallback((content: string, fileId: string): void => {
        if (!enabled || !documentId || !teamId) {
            return;
        }

        scheduleContentUpdate({
            eventName: 'latex_update_content',
            documentId,
            teamId,
            fileId,
            content,
            timestamp: Date.now()
        });
    }, [documentId, enabled, scheduleContentUpdate, teamId]);

    return {
        collaborators,
        sendContentUpdate
    };
};

export default useLatexDocumentSocket;
