import { latexDocumentQuery, useUpdateLatexDocumentMutation, useExportLatexDocumentTexMutation, useExportLatexDocumentZipMutation, useCompileLatexDocumentMutation } from '@/modules/latex/hooks/queries';
import useLatexDocumentSocket from '@/modules/latex/hooks/use-latex-document-socket';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseLatexWorkspaceInput {
    documentId: string;
};

/** Virtual file entry shown in the left panel. In Phase 2 the document has a single file: main.tex. */
export interface LatexFileEntry {
    name: string;
    isSelected: boolean;
};

const SAVE_TOAST = {
    loading: { title: 'Saving document...' },
    success: { title: 'Document saved' },
    error: { title: 'Failed to save document' }
};

const EXPORT_TEX_TOAST = {
    loading: { title: 'Exporting .tex file...' },
    success: { title: 'Export ready' },
    error: { title: 'Failed to export document' }
};

const EXPORT_ZIP_TOAST = {
    loading: { title: 'Exporting .zip archive...' },
    success: { title: 'Export ready' },
    error: { title: 'Failed to export document' }
};

const COMPILE_TOAST = {
    loading: { title: 'Compiling document...' },
    success: { title: 'Compilation successful' },
    error: { title: 'Compilation failed' }
};

const MAIN_FILE_NAME = 'main.tex';

const useLatexWorkspace = ({ documentId }: UseLatexWorkspaceInput) => {
    const teamId = useSelectedTeamId();
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();

    const documentQueryResult = latexDocumentQuery({ documentId }, { enabled: !!documentId });

    const document = documentQueryResult.data;
    const isLoading = documentQueryResult.isLoading;

    const [editorContent, setEditorContent] = useState<string>('');
    const [isDirty, setIsDirty] = useState(false);

    /**
     * Tracks the content value of the last remote update applied.
     * Used to avoid re-broadcasting content back over the socket when
     * Monaco fires onChange in response to a programmatic value change.
     */
    const remoteContentRef = useRef<string>('');

    const { mutateAsync: updateDocument, isPending: isSaving } = useUpdateLatexDocumentMutation();
    const { mutateAsync: exportTex, isPending: isExportingTex } = useExportLatexDocumentTexMutation();
    const { mutateAsync: exportZip, isPending: isExportingZip } = useExportLatexDocumentZipMutation();
    const { mutateAsync: compileDocument, isPending: isCompiling } = useCompileLatexDocumentMutation();

    const [compiledPdfUrl, setCompiledPdfUrl] = useState<string | null>(null);
    const [compileError, setCompileError] = useState<string | null>(null);
    const compiledPdfUrlRef = useRef<string | null>(null);

    useEffect(() => {
        if (!documentQueryResult.error) return;
        checkAccessDeniedError(documentQueryResult.error);
    }, [checkAccessDeniedError, documentQueryResult.error]);

    useEffect(() => {
        const currentUrl = compiledPdfUrlRef.current;
        return () => {
            if (currentUrl) {
                URL.revokeObjectURL(currentUrl);
            }
        };
    }, []);

    useEffect(() => {
        if (!document) return;
        setEditorContent(document.content ?? '');
        setIsDirty(false);
    }, [document]);

    const handleRemoteContentUpdate = useCallback((content: string): void => {
        remoteContentRef.current = content;
        setEditorContent(content);
        setIsDirty(false);
    }, []);

    const { collaborators, sendContentUpdate } = useLatexDocumentSocket({
        documentId,
        teamId: teamId ?? undefined,
        enabled: !!documentId && !!teamId,
        onRemoteContentUpdate: handleRemoteContentUpdate
    });

    const handleEditorChange = useCallback((value: string | undefined): void => {
        const content = value ?? '';
        setEditorContent(content);
        setIsDirty(true);

        // Skip broadcasting if this onChange was triggered by applying a remote update,
        // preventing an echo loop back to the server.
        if (content === remoteContentRef.current) {
            remoteContentRef.current = '';
            return;
        }

        sendContentUpdate(content);
    }, [sendContentUpdate]);

    const handleSave = useCallback(async (): Promise<void> => {
        if (!documentId || isSaving) return;

        try {
            await showPromise(
                updateDocument({ documentId, content: editorContent }),
                SAVE_TOAST
            );
            setIsDirty(false);
        } catch (error) {
            checkAccessDeniedError(error);
        }
    }, [checkAccessDeniedError, documentId, editorContent, isSaving, updateDocument]);

    const handleInsertAssetRef = useCallback((ref: string): void => {
        const next = `${editorContent}\n${ref}`;
        setEditorContent(next);
        setIsDirty(true);
        sendContentUpdate(next);
    }, [editorContent, sendContentUpdate]);

    const handleExportTex = useCallback(async (): Promise<void> => {
        if (!documentId) return;
        const safeName = (document?.title ?? 'document').replace(/[^a-zA-Z0-9._-]+/g, '-');

        await showPromise(
            async () => {
                const blob = await exportTex({ documentId });
                triggerBrowserDownload(blob, `${safeName}.tex`);
            },
            EXPORT_TEX_TOAST
        );
    }, [document?.title, documentId, exportTex]);

    const handleExportZip = useCallback(async (): Promise<void> => {
        if (!documentId) return;
        const safeName = (document?.title ?? 'document').replace(/[^a-zA-Z0-9._-]+/g, '-');

        await showPromise(
            async () => {
                const blob = await exportZip({ documentId });
                triggerBrowserDownload(blob, `${safeName}.zip`);
            },
            EXPORT_ZIP_TOAST
        );
    }, [document?.title, documentId, exportZip]);

    const handleCompile = useCallback(async (): Promise<void> => {
        if (!documentId) return;

        setCompileError(null);

        try {
            const blob = await showPromise(
                compileDocument({ documentId }),
                COMPILE_TOAST
            );

            if (compiledPdfUrlRef.current) {
                URL.revokeObjectURL(compiledPdfUrlRef.current);
            }

            const pdfUrl = URL.createObjectURL(blob);
            compiledPdfUrlRef.current = pdfUrl;
            setCompiledPdfUrl(pdfUrl);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown compilation error';
            setCompileError(message);
        }
    }, [compileDocument, documentId]);

    const files: LatexFileEntry[] = [
        { name: MAIN_FILE_NAME, isSelected: true }
    ];

    return {
        document,
        documentId,
        isLoading,
        editorContent,
        isDirty,
        isSaving,
        isExportingTex,
        isExportingZip,
        isCompiling,
        compiledPdfUrl,
        compileError,
        accessDenied,
        accessDeniedMessage,
        files,
        collaborators,
        handleEditorChange,
        handleSave,
        handleInsertAssetRef,
        handleExportTex,
        handleExportZip,
        handleCompile
    };
};

export default useLatexWorkspace;

