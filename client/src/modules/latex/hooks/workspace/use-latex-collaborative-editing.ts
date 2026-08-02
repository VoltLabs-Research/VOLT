import useLatexDocumentSocket from '@/modules/latex/hooks/use-latex-document-socket';
import { invalidateLatexFilesQuery } from '@/modules/latex/hooks/queries';
import { createFileEditorState, isTexFile } from '@/modules/latex/hooks/workspace/editor-helpers';
import { useCallback, useEffect } from 'react';

import type useLatexFileEditorStates from '@/modules/latex/hooks/workspace/use-latex-file-editor-states';
import type { LatexWorkspaceSelection } from '@/modules/latex/contracts/workspace';
import type { LatexFile } from '@volt/contracts/modules/latex/domain';

interface UseLatexCollaborativeEditingInput{
    documentId: string;
    teamId?: string;
    files: LatexFile[];
    /** Files open in any editor group, each of which needs a live session. */
    openCollaborativeFileIds: string[];
    editorStates: ReturnType<typeof useLatexFileEditorStates>;
    clearAutosaveTimer: (fileId: string) => void;
    scheduleFileAutosave: (fileId: string, content: string) => void;
    scheduleLiveCompile: () => void;
}

/**
 * Routes every edit of a file's buffer to the right transport.
 *
 * A file with a joined collaboration session goes through the shared document, which
 * is authoritative and needs no autosave. A file without one falls back to debounced
 * writes. Remote content arriving for a dirty buffer is parked rather than applied.
 */
const useLatexCollaborativeEditing = ({
    documentId,
    teamId,
    files,
    openCollaborativeFileIds,
    editorStates,
    clearAutosaveTimer,
    scheduleFileAutosave,
    scheduleLiveCompile
}: UseLatexCollaborativeEditingInput) => {
    const {
        fileEditorStatesRef,
        pendingRemoteUpdates,
        acceptRemoteContent,
        writeFileState,
        stashPendingRemoteUpdate,
        clearPendingRemoteUpdate
    } = editorStates;

    const applyRemoteContent = useCallback((fileId: string, content: string): void => {
        clearAutosaveTimer(fileId);
        clearPendingRemoteUpdate(fileId);
        acceptRemoteContent(fileId, content);
    }, [acceptRemoteContent, clearAutosaveTimer, clearPendingRemoteUpdate]);

    const handleRemoteContentUpdate = useCallback((content: string, timestamp: number, fileId: string): void => {
        if (!files.some((file) => file._id === fileId)) {
            invalidateLatexFilesQuery({ documentId });
            return;
        }

        const currentState = fileEditorStatesRef.current[fileId];

        if (currentState?.isDirty && currentState.content !== content) {
            stashPendingRemoteUpdate(fileId, {
                content,
                timestamp
            });
            return;
        }

        applyRemoteContent(fileId, content);
    }, [applyRemoteContent, documentId, fileEditorStatesRef, files, stashPendingRemoteUpdate]);

    const {
        collaborators,
        sendContentUpdate,
        ensureFileSession,
        applyLocalContentChange
    } = useLatexDocumentSocket({
        documentId,
        teamId,
        enabled: !!documentId && !!teamId,
        onRemoteContentUpdate: handleRemoteContentUpdate
    });

    const applyFileContentUpdate = useCallback((targetSelection: LatexWorkspaceSelection, content: string): void => {
        if (targetSelection?.type !== 'file') return;

        const file = files.find((currentFile) => currentFile._id === targetSelection.id);
        if (!file) return;

        const currentState = fileEditorStatesRef.current[file._id] ?? createFileEditorState(file.content);
        const isRemoteEcho = content === currentState.remoteContent;
        const appliedCollaboratively = isRemoteEcho || applyLocalContentChange(file._id, content);

        writeFileState(file._id, {
            content,
            lastSavedContent: appliedCollaboratively ? content : currentState.lastSavedContent,
            isDirty: appliedCollaboratively ? false : content !== currentState.lastSavedContent,
            remoteContent: appliedCollaboratively ? content : currentState.remoteContent
        });

        if (!appliedCollaboratively) {
            sendContentUpdate(content, file._id);
            scheduleFileAutosave(file._id, content);
            return;
        }

        clearAutosaveTimer(file._id);

        if (!isRemoteEcho && isTexFile(file.name)) {
            scheduleLiveCompile();
        }
    }, [
        applyLocalContentChange,
        clearAutosaveTimer,
        fileEditorStatesRef,
        files,
        scheduleFileAutosave,
        scheduleLiveCompile,
        sendContentUpdate,
        writeFileState
    ]);

    /**
     * Joining a session replays the shared history, which can land while the user is
     * already typing, so the local buffer is pushed back in afterwards.
     */
    useEffect(() => {
        if (!documentId || !teamId) {
            return;
        }

        openCollaborativeFileIds.forEach((fileId) => {
            const file = files.find((currentFile) => currentFile._id === fileId);
            if (!file) {
                return;
            }

            const initialContent = fileEditorStatesRef.current[fileId]?.content ?? file.content;
            ensureFileSession(fileId, initialContent).then((joined) => {
                if (!joined) {
                    return;
                }

                const latestContent = fileEditorStatesRef.current[fileId]?.content ?? initialContent;
                if (latestContent !== initialContent) {
                    applyLocalContentChange(fileId, latestContent);
                }
            });
        });
    }, [applyLocalContentChange, documentId, ensureFileSession, fileEditorStatesRef, files, openCollaborativeFileIds, teamId]);

    const applyPendingRemoteUpdate = useCallback((fileId: string): void => {
        const pendingUpdate = pendingRemoteUpdates[fileId];
        if (pendingUpdate) {
            applyRemoteContent(fileId, pendingUpdate.content);
        }
    }, [applyRemoteContent, pendingRemoteUpdates]);

    return {
        collaborators,
        applyFileContentUpdate,
        applyPendingRemoteUpdate,
        dismissPendingRemoteUpdate: clearPendingRemoteUpdate
    };
};

export default useLatexCollaborativeEditing;
