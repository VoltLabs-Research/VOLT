import { useCallback, useEffect, useRef, useState } from 'react';
import { useKeyboardShortcut } from '@/shared/ui/hooks/use-keyboard-shortcut';
import type { SaveStatus } from '@voltstack/bravais';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import useSaveWorkflow from './use-save-workflow';

const SAVED_RESET_DELAY_MS = 2000;
const ERROR_RESET_DELAY_MS = 3000;

/**
 * Owns the builder's save lifecycle: the transient save-status indicator, the
 * unsaved-changes flag derived from the workflow graph, the Ctrl+S shortcut and
 * the browser unload guard.
 */
const useWorkflowSaveStatus = () => {
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isSaving = usePluginBuilderStore((state) => state.isSaving);
    // Recomputed on every builder-store write, but only re-renders when the
    // serialised graph actually differs.
    const workflowFingerprint = usePluginBuilderStore((state) => JSON.stringify(state.getWorkflow()));
    const saveWorkflow = useSaveWorkflow();

    const clearResetTimeout = useCallback(() => {
        if (!resetTimeoutRef.current) {
            return;
        }

        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
    }, []);

    useEffect(() => clearResetTimeout, [clearResetTimeout]);

    const save = useCallback(async () => {
        if (isSaving) {
            return;
        }

        clearResetTimeout();
        setSaveStatus('saving');

        let isSaved = false;
        try {
            isSaved = Boolean(await saveWorkflow());
        } catch {
            isSaved = false;
        }

        if (isSaved) {
            setHasUnsavedChanges(false);
        }

        setSaveStatus(isSaved ? 'saved' : 'error');
        resetTimeoutRef.current = setTimeout(() => {
            setSaveStatus('idle');
            resetTimeoutRef.current = null;
        }, isSaved ? SAVED_RESET_DELAY_MS : ERROR_RESET_DELAY_MS);
    }, [clearResetTimeout, isSaving, saveWorkflow]);

    useKeyboardShortcut('s', save, { ctrl: true });

    const isFirstFingerprint = useRef(true);

    useEffect(() => {
        if (isFirstFingerprint.current) {
            isFirstFingerprint.current = false;
            return;
        }

        setHasUnsavedChanges(true);
    }, [workflowFingerprint]);

    useEffect(() => {
        if (!hasUnsavedChanges) {
            return;
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    return {
        saveStatus,
        hasUnsavedChanges,
        save
    };
};

export default useWorkflowSaveStatus;
