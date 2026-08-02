import useSocket from '@/modules/socket/hooks/use-socket';
import useSocketRoom from '@/modules/socket/hooks/use-socket-room';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import useThrottledSocketEmit from '@/modules/socket/hooks/use-throttled-socket-emit';
import { SOCKET_LATEX_EVENTS } from '@/modules/socket/events/latex';
import { socketErrorReporter } from '@/modules/socket/services/socket-error-reporter';
import type { SocketAck } from '@/modules/socket/contracts/socket-service';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PresenceUser } from '@volt/contracts/modules/socket/domain';
import * as Y from 'yjs';

const CONTENT_DEBOUNCE_MS = 500;
const LATEX_Y_TEXT_NAME = 'content';
const LOCAL_ORIGIN = 'latex:local';
const REMOTE_ORIGIN = 'latex:remote';

interface LatexContentUpdatedPayload {
    documentId: string;
    fileId: string;
    content: string;
    timestamp: number;
    senderId: string;
}

interface LatexContentUpdatePayload {
    documentId: string;
    teamId: string;
    fileId: string;
    content: string;
    timestamp: number;
}

interface LatexFileUpdateAppliedPayload {
    documentId: string;
    fileId: string;
    update: number[];
}

interface LatexFileJoinAck {
    documentId: string;
    fileId: string;
    content: string;
    update: number[];
}

interface LatexFileSession {
    doc: Y.Doc;
    text: Y.Text;
    joined: boolean;
}

interface TextSplice {
    index: number;
    deleteCount: number;
    insertText: string;
}

interface UseLatexDocumentSocketProps {
    documentId?: string;
    teamId?: string;
    enabled?: boolean;
    onRemoteContentUpdate?: (content: string, timestamp: number, fileId: string) => void;
}

/** `SocketAck.data` is declared optional, so a successful ack still has to be narrowed. */
const readAckData = <TData,>(ack: SocketAck<TData>, fallbackMessage: string): TData => {
    if (!ack.ok || !ack.data) {
        throw new Error(ack.error ?? fallbackMessage);
    }

    return ack.data;
};

const computeTextSplice = (currentText: string, nextText: string): TextSplice => {
    let prefixLength = 0;
    const minLength = Math.min(currentText.length, nextText.length);

    while (
        prefixLength < minLength
        && currentText.charCodeAt(prefixLength) === nextText.charCodeAt(prefixLength)
    ) {
        prefixLength += 1;
    }

    let currentSuffixIndex = currentText.length - 1;
    let nextSuffixIndex = nextText.length - 1;
    while (
        currentSuffixIndex >= prefixLength
        && nextSuffixIndex >= prefixLength
        && currentText.charCodeAt(currentSuffixIndex) === nextText.charCodeAt(nextSuffixIndex)
    ) {
        currentSuffixIndex -= 1;
        nextSuffixIndex -= 1;
    }

    return {
        index: prefixLength,
        deleteCount: currentSuffixIndex - prefixLength + 1,
        insertText: nextText.slice(prefixLength, nextSuffixIndex + 1)
    };
};

const useLatexDocumentSocket = ({
    documentId,
    teamId,
    enabled = true,
    onRemoteContentUpdate
}: UseLatexDocumentSocketProps) => {
    const socketService = useSocket();
    const isActive = enabled && !!documentId && !!teamId;
    const [collaborators, setCollaborators] = useState<PresenceUser[]>([]);
    const sessionsRef = useRef(new Map<string, LatexFileSession>());
    const onRemoteContentUpdateRef = useRef(onRemoteContentUpdate);

    onRemoteContentUpdateRef.current = onRemoteContentUpdate;

    const getOrCreateSession = useCallback((fileId: string): LatexFileSession => {
        const existing = sessionsRef.current.get(fileId);
        if (existing) {
            return existing;
        }

        const doc = new Y.Doc();
        const text = doc.getText(LATEX_Y_TEXT_NAME);
        const session: LatexFileSession = {
            doc,
            text,
            joined: false
        };

        doc.on('update', (update: Uint8Array, origin: unknown) => {
            if (origin !== LOCAL_ORIGIN || !session.joined || !documentId || !teamId) {
                return;
            }

            socketService.emit(SOCKET_LATEX_EVENTS.FILE_UPDATE, {
                documentId,
                teamId,
                fileId,
                update: Array.from(update)
            }).catch((error) => {
                socketErrorReporter.report(error, {
                    kind: 'emit',
                    event: SOCKET_LATEX_EVENTS.FILE_UPDATE
                });
            });
        });

        sessionsRef.current.set(fileId, session);
        return session;
    }, [documentId, socketService, teamId]);

    useSocketRoom({
        joinEvent: SOCKET_LATEX_EVENTS.OPEN,
        leaveEvent: SOCKET_LATEX_EVENTS.CLOSE,
        roomKey: isActive ? documentId ?? null : null,
        buildJoinPayload: () => (documentId && teamId) ? {
            documentId,
            teamId
        } : null,
        buildLeavePayload: () => documentId ? { documentId } : null,
        enabled: isActive,
        fireAndForget: false
    });

    useSocketEvent<LatexContentUpdatedPayload>(SOCKET_LATEX_EVENTS.CONTENT_UPDATED, (payload) => {
        if (payload.documentId !== documentId) return;
        onRemoteContentUpdateRef.current?.(payload.content, payload.timestamp, payload.fileId);
    }, { enabled: isActive });

    useSocketEvent<LatexFileUpdateAppliedPayload>(SOCKET_LATEX_EVENTS.FILE_UPDATE_APPLIED, (payload) => {
        if (payload.documentId !== documentId) return;

        const session = getOrCreateSession(payload.fileId);
        Y.applyUpdate(session.doc, new Uint8Array(payload.update), REMOTE_ORIGIN);
        session.joined = true;
        onRemoteContentUpdateRef.current?.(session.text.toString(), Date.now(), payload.fileId);
    }, { enabled: isActive });

    useSocketEvent<PresenceUser[]>(SOCKET_LATEX_EVENTS.USERS_UPDATE, setCollaborators, { enabled: isActive });

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

    const ensureFileSession = useCallback(async (fileId: string, initialContent: string): Promise<boolean> => {
        if (!isActive || !documentId || !teamId) {
            return false;
        }

        const session = getOrCreateSession(fileId);
        if (session.joined) {
            return true;
        }

        try {
            await socketService.connect();
            const ack = await socketService.emit<SocketAck<LatexFileJoinAck>>(SOCKET_LATEX_EVENTS.FILE_JOIN, {
                documentId,
                teamId,
                fileId
            });
            const data = readAckData(ack, 'LaTeX file collaboration join failed.');

            Y.applyUpdate(session.doc, new Uint8Array(data.update), REMOTE_ORIGIN);
            session.joined = true;

            const resolvedContent = session.text.toString() || data.content;
            if (resolvedContent !== initialContent) {
                onRemoteContentUpdateRef.current?.(resolvedContent, Date.now(), fileId);
            }

            return true;
        } catch (error) {
            socketErrorReporter.report(error, {
                kind: 'subscribe',
                event: SOCKET_LATEX_EVENTS.FILE_JOIN,
                roomKey: fileId
            });
            return false;
        }
    }, [documentId, getOrCreateSession, isActive, socketService, teamId]);

    const applyLocalContentChange = useCallback((fileId: string, content: string): boolean => {
        const session = sessionsRef.current.get(fileId);
        if (!session?.joined) {
            return false;
        }

        const currentContent = session.text.toString();
        if (currentContent === content) {
            return true;
        }

        const splice = computeTextSplice(currentContent, content);
        session.doc.transact(() => {
            if (splice.deleteCount > 0) {
                session.text.delete(splice.index, splice.deleteCount);
            }

            if (splice.insertText.length > 0) {
                session.text.insert(splice.index, splice.insertText);
            }
        }, LOCAL_ORIGIN);

        return true;
    }, []);

    useEffect(() => {
        const sessions = sessionsRef.current;

        return () => {
            for (const fileId of sessions.keys()) {
                if (socketService.isConnected() && documentId) {
                    socketService.emitWithoutAck(SOCKET_LATEX_EVENTS.FILE_LEAVE, {
                        documentId,
                        fileId
                    });
                }
            }

            for (const session of sessions.values()) {
                session.doc.destroy();
            }
            sessions.clear();
        };
    }, [documentId, socketService]);

    return {
        collaborators,
        sendContentUpdate,
        ensureFileSession,
        applyLocalContentChange
    };
};

export default useLatexDocumentSocket;
