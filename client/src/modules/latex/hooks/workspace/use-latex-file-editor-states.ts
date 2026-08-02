import { createFileEditorState } from '@/modules/latex/hooks/workspace/editor-helpers';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
    FileEditorState,
    LatexWorkspaceSelection,
    PendingRemoteFileUpdate
} from '@/modules/latex/contracts/workspace';
import type { LatexFile } from '@volt/contracts/modules/latex/domain';

/**
 * The per-file editor buffers: what the user sees, what was last saved, and what
 * the collaboration session last agreed on.
 *
 * A buffer only follows the server copy while it is clean. A dirty buffer is left
 * alone and the incoming content is parked in `pendingRemoteUpdates` for the user
 * to accept or discard, so a remote edit can never silently overwrite typing.
 */
const useLatexFileEditorStates = (files: LatexFile[]) => {
    const [fileEditorStates, setFileEditorStates] = useState<Record<string, FileEditorState>>({});
    const [pendingRemoteUpdates, setPendingRemoteUpdates] = useState<Record<string, PendingRemoteFileUpdate>>({});
    const fileEditorStatesRef = useRef<Record<string, FileEditorState>>({});

    useEffect(() => {
        fileEditorStatesRef.current = fileEditorStates;
    }, [fileEditorStates]);

    const seedFileState = useCallback((fileId: string, content: string): void => {
        setFileEditorStates((currentStates) => currentStates[fileId]
            ? currentStates
            : {
                ...currentStates,
                [fileId]: createFileEditorState(content)
            });
    }, []);

    const writeFileState = useCallback((fileId: string, state: FileEditorState): void => {
        // Updated eagerly as well as through the effect below: a remote update landing in
        // the same tick as a keystroke must still see the buffer as dirty and park itself.
        fileEditorStatesRef.current = {
            ...fileEditorStatesRef.current,
            [fileId]: state
        };
        setFileEditorStates((currentStates) => ({
            ...currentStates,
            [fileId]: state
        }));
    }, []);

    const commitSavedContent = useCallback((fileId: string, content: string): void => {
        setFileEditorStates((currentStates) => {
            const state = currentStates[fileId];
            if (!state) {
                return currentStates;
            }

            return {
                ...currentStates,
                [fileId]: {
                    ...state,
                    lastSavedContent: content,
                    isDirty: state.content !== content
                }
            };
        });
    }, []);

    /** Adopts remote content wholesale, dropping any local divergence. */
    const acceptRemoteContent = useCallback((fileId: string, content: string): void => {
        setFileEditorStates((currentStates) => ({
            ...currentStates,
            [fileId]: createFileEditorState(content)
        }));
    }, []);

    const stashPendingRemoteUpdate = useCallback((fileId: string, update: PendingRemoteFileUpdate): void => {
        setPendingRemoteUpdates((currentUpdates) => ({
            ...currentUpdates,
            [fileId]: update
        }));
    }, []);

    const clearPendingRemoteUpdate = useCallback((fileId: string): void => {
        setPendingRemoteUpdates((currentUpdates) => {
            if (!(fileId in currentUpdates)) {
                return currentUpdates;
            }

            const nextUpdates = { ...currentUpdates };
            delete nextUpdates[fileId];
            return nextUpdates;
        });
    }, []);

    const getEditorContentForSelection = useCallback((targetSelection: LatexWorkspaceSelection): string => {
        if (!targetSelection || targetSelection.type !== 'file') {
            return '';
        }

        const file = files.find((currentFile) => currentFile._id === targetSelection.id);
        if (!file) {
            return '';
        }

        return fileEditorStates[targetSelection.id]?.content ?? file.content;
    }, [fileEditorStates, files]);

    const getPendingRemoteUpdateForSelection = useCallback((targetSelection: LatexWorkspaceSelection): PendingRemoteFileUpdate | null => {
        return targetSelection?.type === 'file'
            ? pendingRemoteUpdates[targetSelection.id] ?? null
            : null;
    }, [pendingRemoteUpdates]);

    const dirtyFileIds = useMemo(
        () => Object.entries(fileEditorStates)
            .filter(([, state]) => state.isDirty)
            .map(([fileId]) => fileId),
        [fileEditorStates]
    );

    /** Follow the server copy for clean buffers, and forget files that disappeared. */
    useEffect(() => {
        setFileEditorStates((currentStates) => {
            let hasChanged = false;
            const nextStates: Record<string, FileEditorState> = {};

            files.forEach((file) => {
                const currentState = currentStates[file._id];

                if (!currentState) {
                    nextStates[file._id] = createFileEditorState(file.content);
                    hasChanged = true;
                    return;
                }

                if (currentState.isDirty) {
                    nextStates[file._id] = currentState;
                    return;
                }

                if (
                    currentState.content !== file.content
                    || currentState.lastSavedContent !== file.content
                    || currentState.remoteContent !== file.content
                ) {
                    nextStates[file._id] = createFileEditorState(file.content);
                    hasChanged = true;
                    return;
                }

                nextStates[file._id] = currentState;
            });

            hasChanged ||= Object.keys(currentStates).some((fileId) => !(fileId in nextStates));

            return hasChanged ? nextStates : currentStates;
        });
    }, [files]);

    useEffect(() => {
        setPendingRemoteUpdates((currentUpdates) => {
            const survivingIds = Object.keys(currentUpdates)
                .filter((fileId) => files.some((file) => file._id === fileId));

            if (survivingIds.length === Object.keys(currentUpdates).length) {
                return currentUpdates;
            }

            return Object.fromEntries(survivingIds.map((fileId) => [fileId, currentUpdates[fileId]]));
        });
    }, [files]);

    return {
        fileEditorStates,
        fileEditorStatesRef,
        pendingRemoteUpdates,
        dirtyFileIds,
        seedFileState,
        writeFileState,
        commitSavedContent,
        acceptRemoteContent,
        stashPendingRemoteUpdate,
        clearPendingRemoteUpdate,
        getEditorContentForSelection,
        getPendingRemoteUpdateForSelection
    };
};

export default useLatexFileEditorStates;
