import { latexDocumentQuery, useUpdateLatexDocumentMutation, useExportLatexDocumentTexMutation, useExportLatexDocumentZipMutation, useCompileLatexDocumentMutation, useUpdateLatexFileMutation } from '@/modules/latex/hooks/queries';
import useLatexDocumentSocket from '@/modules/latex/hooks/use-latex-document-socket';
import useLatexFiles from '@/modules/latex/hooks/use-latex-files';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LatexFile } from '@/modules/latex/api/entities/latex-file';

interface UseLatexWorkspaceInput {
    documentId: string;
};

/** Represents a LatexFile visible in the file panel. */
export interface LatexFileEntry {
    _id: string;
    name: string;
    path: string;
    isEntrypoint: boolean;
    isSelected: boolean;
};

const SAVE_TOAST = {
    loading: { title: 'Saving file...' },
    success: { title: 'File saved' },
    error: { title: 'Failed to save file' }
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

const RENAME_TOAST = {
    loading: { title: 'Renaming document...' },
    success: { title: 'Document renamed' },
    error: { title: 'Failed to rename document' }
};

const useLatexWorkspace = ({ documentId }: UseLatexWorkspaceInput) => {
    const teamId = useSelectedTeamId();
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();

    const documentQueryResult = latexDocumentQuery({ documentId }, { enabled: !!documentId });

    const latexDocument = documentQueryResult.data;
    const isLoading = documentQueryResult.isLoading;

    const [activeFile, setActiveFile] = useState<LatexFile | null>(null);
    const [editorContent, setEditorContent] = useState<string>('');
    const [isDirty, setIsDirty] = useState(false);

    const remoteContentRef = useRef<string>('');

    const { mutateAsync: updateDocument } = useUpdateLatexDocumentMutation();
    const { mutateAsync: updateFile, isPending: isSaving } = useUpdateLatexFileMutation();
    const { mutateAsync: exportTex, isPending: isExportingTex } = useExportLatexDocumentTexMutation();
    const { mutateAsync: exportZip, isPending: isExportingZip } = useExportLatexDocumentZipMutation();
    const { mutateAsync: compileDocument, isPending: isCompiling } = useCompileLatexDocumentMutation();

    const [compiledPdfUrl, setCompiledPdfUrl] = useState<string | null>(null);
    const [compileError, setCompileError] = useState<string | null>(null);
    const compiledPdfUrlRef = useRef<string | null>(null);

    const handleFileSelected = useCallback((file: LatexFile): void => {
        setActiveFile(file);
        setEditorContent(file.content);
        setIsDirty(false);
        remoteContentRef.current = '';
    }, []);

    const { files: latexFiles, isLoading: isLoadingFiles, ...fileActions } = useLatexFiles({        documentId,
        onFileSelected: handleFileSelected
    });

    const handleSelectFileById = useCallback((fileId: string): void => {
        const file = latexFiles.find((f) => f._id === fileId);
        if (file) {
            handleFileSelected(file);
        }
    }, [latexFiles, handleFileSelected]);

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

    // When the file list loads, auto-select the entrypoint file.
    useEffect(() => {
        if (latexFiles.length === 0 || activeFile) return;
        const entrypoint = latexFiles.find((f) => f.isEntrypoint) ?? latexFiles[0];
        setActiveFile(entrypoint);
        setEditorContent(entrypoint.content);
    }, [latexFiles, activeFile]);

    // When the active file changes in the file list (e.g. content was updated by remote),
    // sync the editor if the file matches the currently active file.
    useEffect(() => {
        if (!activeFile) return;
        const updatedFile = latexFiles.find((f) => f._id === activeFile._id);
        if (!updatedFile || updatedFile.content === editorContent) return;
        // Only sync if we don't have unsaved local changes.
        if (!isDirty) {
            setEditorContent(updatedFile.content);
        }
    }, [latexFiles, activeFile, editorContent, isDirty]);

    const handleRemoteContentUpdate = useCallback((content: string, _timestamp: number, fileId?: string): void => {
        if (fileId && activeFile?._id !== fileId) return;
        remoteContentRef.current = content;
        setEditorContent(content);
        setIsDirty(false);
    }, [activeFile]);

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

        if (content === remoteContentRef.current) {
            remoteContentRef.current = '';
            return;
        }

        sendContentUpdate(content, activeFile?._id);
    }, [sendContentUpdate, activeFile]);

    const handleRenameDocument = useCallback(async (title: string): Promise<void> => {
        try {
            await showPromise(
                updateDocument({ documentId, title }),
                RENAME_TOAST
            );
        } catch (error) {
            checkAccessDeniedError(error);
        }
    }, [checkAccessDeniedError, documentId, updateDocument]);

    const handleSave = useCallback(async (): Promise<void> => {
        if (isSaving) return;

        try {
            if (activeFile) {
                await showPromise(
                    updateFile({ documentId, fileId: activeFile._id, content: editorContent }),
                    SAVE_TOAST
                );
            } else {
                await showPromise(
                    updateDocument({ documentId, content: editorContent }),
                    SAVE_TOAST
                );
            }
            setIsDirty(false);
        } catch (error) {
            checkAccessDeniedError(error);
        }
    }, [activeFile, checkAccessDeniedError, documentId, editorContent, isSaving, updateDocument, updateFile]);

    const handleInsertAssetRef = useCallback((ref: string): void => {
        const next = `${editorContent}\n${ref}`;
        setEditorContent(next);
        setIsDirty(true);
        sendContentUpdate(next, activeFile?._id);
    }, [activeFile, editorContent, sendContentUpdate]);

    const handleExportTex = useCallback(async (): Promise<void> => {
        if (!documentId) return;
        const safeName = (latexDocument?.title ?? 'document').replace(/[^a-zA-Z0-9._-]+/g, '-');

        await showPromise(
            async () => {
                const blob = await exportTex({ documentId });
                triggerBrowserDownload(blob, `${safeName}.tex`);
            },
            EXPORT_TEX_TOAST
        );
    }, [latexDocument?.title, documentId, exportTex]);

    const handleExportZip = useCallback(async (): Promise<void> => {
        if (!documentId) return;
        const safeName = (latexDocument?.title ?? 'document').replace(/[^a-zA-Z0-9._-]+/g, '-');

        await showPromise(
            async () => {
                const blob = await exportZip({ documentId });
                triggerBrowserDownload(blob, `${safeName}.zip`);
            },
            EXPORT_ZIP_TOAST
        );
    }, [latexDocument?.title, documentId, exportZip]);

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

    const files = useMemo<LatexFileEntry[]>(
        () => latexFiles.map((f) => ({
            _id: f._id,
            name: f.name,
            path: f.path,
            isEntrypoint: f.isEntrypoint,
            isSelected: f._id === activeFile?._id
        })),
        [latexFiles, activeFile?._id]
    );

    return {
        latexDocument,
        documentId,
        isLoading: isLoading || isLoadingFiles,
        activeFile,
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
        handleRenameDocument,
        handleSave,
        handleInsertAssetRef,
        handleExportTex,
        handleExportZip,
        handleCompile,
        handleSelectFileById,
        ...fileActions
    };
};

export default useLatexWorkspace;

