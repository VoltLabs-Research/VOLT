import { LIVE_COMPILE_DELAY, isTexFile } from '@/modules/latex/hooks/workspace/editor-helpers';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { LatexFile } from '@volt/contracts/modules/latex/domain';

interface UseLatexAutoCompileInput{
    documentId: string;
    files: LatexFile[];
    /** False while the workspace is still loading or an import is rewriting it. */
    isWorkspaceSettled: boolean;
    compileSilently: () => Promise<unknown>;
}

/**
 * Decides *when* the PDF preview is rebuilt: debounced while the user types, and
 * once whenever the set of tex files itself changes (rename, move, new entrypoint).
 *
 * The tex layout is compared as a fingerprint because content edits already trigger
 * their own debounced compile, and recompiling on every keystroke's query refetch
 * would queue redundant runs.
 */
const useLatexAutoCompile = ({
    documentId,
    files,
    isWorkspaceSettled,
    compileSilently
}: UseLatexAutoCompileInput) => {
    const liveCompileTimerRef = useRef<number | null>(null);
    const lastFingerprintRef = useRef<string | null>(null);

    const texWorkspaceFingerprint = useMemo(
        () => files
            .filter((file) => isTexFile(file.name))
            .map((file) => `${file._id}:${file.name}:${file.path}:${file.isEntrypoint}`)
            .join('|'),
        [files]
    );

    const scheduleLiveCompile = useCallback((): void => {
        if (liveCompileTimerRef.current) {
            window.clearTimeout(liveCompileTimerRef.current);
        }

        liveCompileTimerRef.current = window.setTimeout(() => {
            liveCompileTimerRef.current = null;
            compileSilently();
        }, LIVE_COMPILE_DELAY);
    }, [compileSilently]);

    useEffect(() => {
        lastFingerprintRef.current = null;
    }, [documentId]);

    useEffect(() => {
        if (!isWorkspaceSettled || lastFingerprintRef.current === texWorkspaceFingerprint) {
            return;
        }

        lastFingerprintRef.current = texWorkspaceFingerprint;
        compileSilently();
    }, [compileSilently, isWorkspaceSettled, texWorkspaceFingerprint]);

    useEffect(() => {
        return () => {
            if (liveCompileTimerRef.current) {
                window.clearTimeout(liveCompileTimerRef.current);
            }
        };
    }, []);

    return {
        scheduleLiveCompile
    };
};

export default useLatexAutoCompile;
