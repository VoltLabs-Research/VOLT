import { AUTOSAVE_DELAY } from '@/modules/latex/hooks/workspace/editor-helpers';
import { useCallback, useEffect, useRef } from 'react';
import { sileo } from 'sileo';

import type { FileEditorState } from '@/modules/latex/contracts/workspace';
import type { LatexFile } from '@volt/contracts/modules/latex/domain';

interface UseLatexAutosaveInput{
    documentId: string;
    files: LatexFile[];
    fileEditorStatesRef: { current: Record<string, FileEditorState> };
    commitSavedContent: (fileId: string, content: string) => void;
    updateFile: (input: { documentId: string; fileId: string; content: string }) => Promise<unknown>;
    compileSilently: () => Promise<unknown>;
    checkAccessDeniedError: (error: unknown) => boolean;
}

/**
 * Debounced writes for files edited outside a collaboration session. One timer per
 * file, and the timer re-reads the buffer when it fires so a save that was queued
 * for stale content is dropped instead of resurrecting it.
 */
const useLatexAutosave = ({
    documentId,
    files,
    fileEditorStatesRef,
    commitSavedContent,
    updateFile,
    compileSilently,
    checkAccessDeniedError
}: UseLatexAutosaveInput) => {
    const autosaveTimersRef = useRef<Record<string, number>>({});

    const clearAutosaveTimer = useCallback((fileId: string): void => {
        const existingTimer = autosaveTimersRef.current[fileId];
        if (!existingTimer) {
            return;
        }

        window.clearTimeout(existingTimer);
        delete autosaveTimersRef.current[fileId];
    }, []);

    const scheduleFileAutosave = useCallback((fileId: string, content: string): void => {
        clearAutosaveTimer(fileId);

        const currentState = fileEditorStatesRef.current[fileId];
        if (!currentState || content === currentState.lastSavedContent) {
            return;
        }

        autosaveTimersRef.current[fileId] = window.setTimeout(async () => {
            try {
                const latestState = fileEditorStatesRef.current[fileId];
                if (!latestState || latestState.content !== content || latestState.lastSavedContent === content) {
                    return;
                }

                await updateFile({
                    documentId,
                    fileId,
                    content
                });

                commitSavedContent(fileId, content);
                await compileSilently();
            } catch (error) {
                checkAccessDeniedError(error);
                sileo.error({ title: 'Failed to save file' });
            } finally {
                delete autosaveTimersRef.current[fileId];
            }
        }, AUTOSAVE_DELAY);
    }, [checkAccessDeniedError, clearAutosaveTimer, commitSavedContent, compileSilently, documentId, fileEditorStatesRef, updateFile]);

    useEffect(() => {
        for (const fileId of Object.keys(autosaveTimersRef.current)) {
            if (!files.some((file) => file._id === fileId)) {
                clearAutosaveTimer(fileId);
            }
        }
    }, [clearAutosaveTimer, files]);

    useEffect(() => {
        const autosaveTimers = autosaveTimersRef.current;

        return () => {
            Object.values(autosaveTimers).forEach(window.clearTimeout);
        };
    }, []);

    return {
        clearAutosaveTimer,
        scheduleFileAutosave
    };
};

export default useLatexAutosave;
