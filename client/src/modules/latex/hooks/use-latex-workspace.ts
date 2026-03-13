import { invalidateLatexFilesQuery, latexDocumentQuery, useCompileLatexDocumentMutation, useExportLatexDocumentTexMutation, useExportLatexDocumentZipMutation, useUpdateLatexDocumentMutation } from '@/modules/latex/hooks/queries';
import useLatexAssets from '@/modules/latex/hooks/use-latex-assets';
import useLatexDocumentSocket from '@/modules/latex/hooks/use-latex-document-socket';
import useLatexFiles from '@/modules/latex/hooks/use-latex-files';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { LatexFile } from '@/modules/latex/api/entities/latex-file';
import { isWorkspaceTextLikeFile } from '@/modules/latex/utilities/workspace';
import { sileo } from 'sileo';

interface UseLatexWorkspaceInput {
    documentId: string;
}

export interface LatexFileEntry {
    _id: string;
    name: string;
    path: string;
    content: string;
    isEntrypoint: boolean;
    isSelected: boolean;
}

export type LatexWorkspaceSelection =
    | { type: 'file'; id: string }
    | { type: 'asset'; id: string }
    | null;

export type LatexWorkspaceTab = Exclude<LatexWorkspaceSelection, null>;

interface FileEditorState {
    content: string;
    lastSavedContent: string;
    remoteContent: string;
    isDirty: boolean;
}

const AUTOSAVE_DELAY = 500;
const TEX_EXTENSION = '.tex';

const createFileEditorState = (content: string): FileEditorState => ({
    content,
    lastSavedContent: content,
    remoteContent: content,
    isDirty: false
});

const isSameWorkspaceTab = (left: LatexWorkspaceSelection, right: LatexWorkspaceSelection): boolean => {
    if (!left || !right) return false;
    return left.type === right.type && left.id === right.id;
};

const getLastWorkspaceTab = (tabs: LatexWorkspaceTab[]): LatexWorkspaceTab | null => {
    return tabs.length > 0 ? tabs[tabs.length - 1] ?? null : null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
    return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
};

const extractErrorMessage = async (error: unknown): Promise<string> => {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    const errorRecord = asRecord(error);
    const response = asRecord(errorRecord?.response);
    const data = response?.data;

    if (data instanceof Blob) {
        try {
            const text = await data.text();
            const parsed = JSON.parse(text) as unknown;
            const parsedRecord = asRecord(parsed);
            if (typeof parsedRecord?.message === 'string' && parsedRecord.message.trim()) {
                return parsedRecord.message;
            }
            if (text.trim()) {
                return text.trim();
            }
        } catch {
            return 'Compilation failed';
        }
    }

    const dataRecord = asRecord(data);
    if (typeof dataRecord?.message === 'string' && dataRecord.message.trim()) {
        return dataRecord.message;
    }

    if (typeof errorRecord?.message === 'string' && errorRecord.message.trim()) {
        return errorRecord.message;
    }

    return 'Compilation failed';
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
    const [selection, setSelection] = useState<LatexWorkspaceSelection>(null);
    const [openTabs, setOpenTabs] = useState<LatexWorkspaceTab[]>([]);
    const [fileEditorStates, setFileEditorStates] = useState<Record<string, FileEditorState>>({});
    const [compiledPdfUrl, setCompiledPdfUrl] = useState<string | null>(null);
    const [compiledPdfBlob, setCompiledPdfBlob] = useState<Blob | null>(null);
    const [compileError, setCompileError] = useState<string | null>(null);

    const fileEditorStatesRef = useRef<Record<string, FileEditorState>>({});
    const sendContentUpdateRef = useRef<((content: string, fileId?: string) => void) | null>(null);
    const compiledPdfUrlRef = useRef<string | null>(null);
    const autosaveTimersRef = useRef<Record<string, number>>({});
    const lastCompiledFingerprintRef = useRef('');
    const lastTexWorkspaceFingerprintRef = useRef<string | null>(null);
    const compileRequestIdRef = useRef(0);
    const hasBootstrappedSelectionRef = useRef(false);
    const isBatchUploadingRef = useRef(false);
    const pendingCompileAfterBatchRef = useRef(false);

    /** Stable set of known file IDs — used by handleRemoteContentUpdate without causing re-subscriptions. */
    const latexFileIdsRef = useRef<Set<string>>(new Set());

    /** Tracks the previous set of file IDs to detect newly appeared files. */
    const prevFileIdsRef = useRef<Set<string>>(new Set());

    const isTexFile = useCallback((name: string): boolean => name.toLowerCase().endsWith(TEX_EXTENSION), []);

    useEffect(() => {
        fileEditorStatesRef.current = fileEditorStates;
    }, [fileEditorStates]);

    useEffect(() => {
        lastTexWorkspaceFingerprintRef.current = null;
        compileRequestIdRef.current = 0;
    }, [documentId]);

    const { mutateAsync: updateDocument } = useUpdateLatexDocumentMutation();
    const { mutateAsync: exportTex, isPending: isExportingTex } = useExportLatexDocumentTexMutation();
    const { mutateAsync: exportZip, isPending: isExportingZip } = useExportLatexDocumentZipMutation();
    const { mutateAsync: compileDocument, isPending: isCompiling } = useCompileLatexDocumentMutation();

    const handleOpenTab = useCallback((tab: LatexWorkspaceTab): void => {
        hasBootstrappedSelectionRef.current = true;
        setOpenTabs((currentTabs) => currentTabs.some((currentTab) => isSameWorkspaceTab(currentTab, tab))
            ? currentTabs
            : [...currentTabs, tab]);
        setSelection(tab);
    }, []);

    const handleSelectTab = useCallback((tab: LatexWorkspaceTab): void => {
        setSelection(tab);
    }, []);

    const handleCloseTab = useCallback((tabToClose: LatexWorkspaceTab): void => {
        setOpenTabs((currentTabs) => {
            const tabIndex = currentTabs.findIndex((currentTab) => isSameWorkspaceTab(currentTab, tabToClose));
            if (tabIndex < 0) {
                return currentTabs;
            }

            const nextTabs = currentTabs.filter((_, index) => index !== tabIndex);
            setSelection((currentSelection) => {
                if (!currentSelection || !isSameWorkspaceTab(currentSelection, tabToClose)) {
                    return currentSelection;
                }

                return nextTabs[tabIndex] ?? nextTabs[tabIndex - 1] ?? null;
            });

            return nextTabs;
        });
    }, []);

    const handleFileSelected = useCallback((file: LatexFile): void => {
        setFileEditorStates((currentStates) => currentStates[file._id]
            ? currentStates
            : {
                ...currentStates,
                [file._id]: createFileEditorState(file.content)
            });
        handleOpenTab({ type: 'file', id: file._id });
    }, [handleOpenTab]);

    const {
        files: latexFiles,
        isLoading: isLoadingFiles,
        isSaving,
        handleCreateFile,
        handleDeleteFile,
        handleSetEntrypoint,
        handleMoveFile,
        handleRenameFile,
        deleteFile,
        updateFile
    } = useLatexFiles({
        documentId,
        onFileSelected: handleFileSelected
    });

    useEffect(() => {
        latexFileIdsRef.current = new Set(latexFiles.map((file) => file._id));
    }, [latexFiles]);

    const activeFile = useMemo(
        () => selection?.type === 'file'
            ? latexFiles.find((file) => file._id === selection.id) ?? null
            : null,
        [latexFiles, selection]
    );

    const hasCompilableTexFile = useMemo(
        () => latexFiles.some((file) => isTexFile(file.name)),
        [isTexFile, latexFiles]
    );

    const texWorkspaceFingerprint = useMemo(
        () => latexFiles
            .filter((file) => isTexFile(file.name))
            .map((file) => `${file._id}:${file.name}:${file.path}:${file.isEntrypoint}`)
            .join('|'),
        [isTexFile, latexFiles]
    );

    const compileSilently = useCallback(async (): Promise<Blob | null> => {
        const requestId = ++compileRequestIdRef.current;
        if (!documentId) return null;

        if (!hasCompilableTexFile) {
            if (requestId !== compileRequestIdRef.current) {
                return null;
            }

            if (compiledPdfUrlRef.current) {
                URL.revokeObjectURL(compiledPdfUrlRef.current);
                compiledPdfUrlRef.current = null;
            }
            setCompiledPdfBlob(null);
            setCompiledPdfUrl(null);
            setCompileError('Add a .tex file to generate the PDF preview.');
            return null;
        }

        setCompileError(null);

        try {
            const blob = await compileDocument({ documentId });

            if (requestId !== compileRequestIdRef.current) {
                return null;
            }

            if (compiledPdfUrlRef.current) {
                URL.revokeObjectURL(compiledPdfUrlRef.current);
            }

            const pdfUrl = URL.createObjectURL(blob);
            compiledPdfUrlRef.current = pdfUrl;
            setCompiledPdfBlob(blob);
            setCompiledPdfUrl(pdfUrl);
            return blob;
        } catch (error) {
            if (requestId !== compileRequestIdRef.current) {
                return null;
            }

            if (compiledPdfUrlRef.current) {
                URL.revokeObjectURL(compiledPdfUrlRef.current);
                compiledPdfUrlRef.current = null;
            }

            setCompiledPdfBlob(null);
            setCompiledPdfUrl(null);
            const message = await extractErrorMessage(error);
            setCompileError(message);
            return null;
        }
    }, [compileDocument, documentId, hasCompilableTexFile]);

    const scheduleFileAutosave = useCallback((fileId: string, content: string): void => {
        const existingTimer = autosaveTimersRef.current[fileId];
        if (existingTimer) {
            window.clearTimeout(existingTimer);
        }

        const currentState = fileEditorStatesRef.current[fileId];
        if (!currentState || content === currentState.lastSavedContent) {
            return;
        }

        autosaveTimersRef.current[fileId] = window.setTimeout(() => {
            void (async () => {
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

                    const fingerprint = `${fileId}:${content}`;
                    if (fingerprint !== lastCompiledFingerprintRef.current) {
                        lastCompiledFingerprintRef.current = fingerprint;
                        await compileSilently();
                    }
                } catch (error) {
                    checkAccessDeniedError(error);
                    sileo.error({ title: 'Failed to save file' });
                } finally {
                    delete autosaveTimersRef.current[fileId];
                }
            })();
        }, AUTOSAVE_DELAY);
    }, [checkAccessDeniedError, compileSilently, documentId, updateFile]);

    const handleInsertAssetRef = useCallback((ref: string): void => {
        if (!selection || selection.type !== 'file') {
            return;
        }

        const file = latexFiles.find((currentFile) => currentFile._id === selection.id);
        if (!file) {
            return;
        }

        const currentState = fileEditorStatesRef.current[file._id] ?? createFileEditorState(file.content);
        const nextContent = `${currentState.content}\n${ref}`;
        const isRemoteEcho = nextContent === currentState.remoteContent;

        setFileEditorStates((currentStates) => ({
            ...currentStates,
            [file._id]: {
                ...currentState,
                content: nextContent,
                isDirty: nextContent !== currentState.lastSavedContent,
                remoteContent: isRemoteEcho ? '' : currentState.remoteContent
            }
        }));

        if (!isRemoteEcho) {
            sendContentUpdateRef.current?.(nextContent, file._id);
        }

        scheduleFileAutosave(file._id, nextContent);
    }, [latexFiles, scheduleFileAutosave, selection]);

    const {
        assets,
        rawAssets,
        isUploading,
        fileInputRef,
        folderInputRef,
        handleUploadEntries,
        handleDeleteAsset,
        handleMoveAsset,
        handleRenameAsset,
        handleCreateFolder,
        deleteAsset,
        updateAsset
    } = useLatexAssets({ documentId, onInsertRef: handleInsertAssetRef });

    const activeAsset = useMemo(
        () => selection?.type === 'asset'
            ? assets.find((asset) => asset._id === selection.id) ?? null
            : null,
        [assets, selection]
    );

    const handleRemoteContentUpdate = useCallback((content: string, _timestamp: number, fileId?: string): void => {
        if (!fileId) {
            return;
        }

        if (!latexFileIdsRef.current.has(fileId)) {
            invalidateLatexFilesQuery({ documentId });
            return;
        }

        const existingTimer = autosaveTimersRef.current[fileId];
        if (existingTimer) {
            window.clearTimeout(existingTimer);
            delete autosaveTimersRef.current[fileId];
        }

        setFileEditorStates((currentStates) => ({
            ...currentStates,
            [fileId]: {
                ...(currentStates[fileId] ?? createFileEditorState(content)),
                content,
                lastSavedContent: content,
                remoteContent: content,
                isDirty: false
            }
        }));
    }, [documentId]);

    const { collaborators, sendContentUpdate } = useLatexDocumentSocket({
        documentId,
        teamId: teamId ?? undefined,
        enabled: !!documentId && !!teamId,
        onRemoteContentUpdate: handleRemoteContentUpdate
    });

    useEffect(() => {
        sendContentUpdateRef.current = sendContentUpdate;
    }, [sendContentUpdate]);

    const isSelectionAvailable = useCallback((candidate: LatexWorkspaceSelection): candidate is LatexWorkspaceTab => {
        if (!candidate) {
            return false;
        }

        return candidate.type === 'file'
            ? latexFiles.some((file) => file._id === candidate.id)
            : assets.some((asset) => asset._id === candidate.id);
    }, [assets, latexFiles]);

    const validOpenTabs = useMemo(
        () => openTabs.filter((tab) => isSelectionAvailable(tab)),
        [isSelectionAvailable, openTabs]
    );

    const activeFileEditorState = activeFile
        ? fileEditorStates[activeFile._id] ?? createFileEditorState(activeFile.content)
        : null;

    const editorContent = activeFileEditorState?.content ?? '';
    const dirtyFileIds = useMemo(
        () => Object.entries(fileEditorStates)
            .filter(([, state]) => state.isDirty)
            .map(([fileId]) => fileId),
        [fileEditorStates]
    );
    const isDirty = dirtyFileIds.length > 0;

    useEffect(() => {
        if (!documentQueryResult.error) return;
        checkAccessDeniedError(documentQueryResult.error);
    }, [checkAccessDeniedError, documentQueryResult.error]);

    useEffect(() => {
        return () => {
            const currentUrl = compiledPdfUrlRef.current;
            if (currentUrl) {
                URL.revokeObjectURL(currentUrl);
            }

            Object.values(autosaveTimersRef.current).forEach((timerId) => {
                window.clearTimeout(timerId);
            });
        };
    }, []);

    useEffect(() => {
        setFileEditorStates((currentStates) => {
            let hasChanged = false;
            const nextStates: Record<string, FileEditorState> = {};
            const nextFileIds = new Set(latexFiles.map((file) => file._id));

            latexFiles.forEach((file) => {
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

            Object.keys(currentStates).forEach((fileId) => {
                if (nextFileIds.has(fileId)) {
                    return;
                }

                const existingTimer = autosaveTimersRef.current[fileId];
                if (existingTimer) {
                    window.clearTimeout(existingTimer);
                    delete autosaveTimersRef.current[fileId];
                }
                hasChanged = true;
            });

            return hasChanged ? nextStates : currentStates;
        });
    }, [latexFiles]);

    /** Auto-open files created externally (e.g. by AI tools). */
    useEffect(() => {
        const currentIds = new Set(latexFiles.map((file) => file._id));
        const prevIds = prevFileIdsRef.current;

        if (prevIds.size > 0) {
            for (const file of latexFiles) {
                if (!prevIds.has(file._id)) {
                    handleFileSelected(file);
                    break;
                }
            }
        }

        prevFileIdsRef.current = currentIds;
    }, [latexFiles, handleFileSelected]);

    useEffect(() => {
        if (validOpenTabs.length === openTabs.length) {
            return;
        }

        setOpenTabs(validOpenTabs);
    }, [openTabs, validOpenTabs]);

    useEffect(() => {
        if (selection && !isSelectionAvailable(selection)) {
            setSelection(getLastWorkspaceTab(validOpenTabs));
            return;
        }

        if (!selection && validOpenTabs.length > 0) {
            setSelection(getLastWorkspaceTab(validOpenTabs));
            return;
        }

        if (
            selection
            || validOpenTabs.length > 0
            || hasBootstrappedSelectionRef.current
            || (latexFiles.length === 0 && assets.length === 0)
        ) {
            return;
        }

        hasBootstrappedSelectionRef.current = true;

        const firstFile = latexFiles.find((file) => isTexFile(file.name))
            ?? latexFiles.find((file) => file.isEntrypoint)
            ?? latexFiles[0];
        if (firstFile) {
            handleFileSelected(firstFile);
            return;
        }

        if (assets[0]) {
            handleOpenTab({ type: 'asset', id: assets[0]._id });
        }
    }, [assets, handleFileSelected, handleOpenTab, isSelectionAvailable, isTexFile, latexFiles, selection, validOpenTabs]);

    useEffect(() => {
        if (isLoading || isLoadingFiles) {
            return;
        }

        if (!latexDocument || lastTexWorkspaceFingerprintRef.current === texWorkspaceFingerprint) {
            return;
        }

        lastTexWorkspaceFingerprintRef.current = texWorkspaceFingerprint;

        if (isBatchUploadingRef.current) {
            pendingCompileAfterBatchRef.current = true;
            return;
        }

        void compileSilently();
    }, [compileSilently, isLoading, isLoadingFiles, latexDocument, texWorkspaceFingerprint]);

    const handleEditorChange = useCallback((value: string | undefined): void => {
        if (!selection || selection.type !== 'file') {
            return;
        }

        const file = latexFiles.find((currentFile) => currentFile._id === selection.id);
        if (!file) {
            return;
        }

        const content = value ?? '';
        const currentState = fileEditorStatesRef.current[file._id] ?? createFileEditorState(file.content);
        const isRemoteEcho = content === currentState.remoteContent;

        setFileEditorStates((currentStates) => ({
            ...currentStates,
            [file._id]: {
                ...currentState,
                content,
                isDirty: content !== currentState.lastSavedContent,
                remoteContent: isRemoteEcho ? '' : currentState.remoteContent
            }
        }));

        if (!isRemoteEcho) {
            sendContentUpdate(content, selection.id);
        }

        scheduleFileAutosave(file._id, content);
    }, [latexFiles, scheduleFileAutosave, selection, sendContentUpdate]);

    const handleRenameDocument = useCallback(async (title: string): Promise<void> => {
        try {
            await updateDocument({ documentId, title });
            sileo.success(RENAME_TOAST.success);
        } catch (error) {
            checkAccessDeniedError(error);
            sileo.error(RENAME_TOAST.error);
        }
    }, [checkAccessDeniedError, documentId, updateDocument]);

    const handleExportTex = useCallback(async (): Promise<void> => {
        if (!documentId) return;
        const safeName = (latexDocument?.title ?? 'document').replace(/[^a-zA-Z0-9._-]+/g, '-');

        try {
            sileo.info(EXPORT_TEX_TOAST.loading);
            const blob = await exportTex({ documentId });
            triggerBrowserDownload(blob, `${safeName}.tex`);
            sileo.success(EXPORT_TEX_TOAST.success);
        } catch {
            sileo.error(EXPORT_TEX_TOAST.error);
        }
    }, [documentId, exportTex, latexDocument?.title]);

    const handleExportZip = useCallback(async (): Promise<void> => {
        if (!documentId) return;
        const safeName = (latexDocument?.title ?? 'document').replace(/[^a-zA-Z0-9._-]+/g, '-');

        try {
            sileo.info(EXPORT_ZIP_TOAST.loading);
            const blob = await exportZip({ documentId });
            triggerBrowserDownload(blob, `${safeName}.zip`);
            sileo.success(EXPORT_ZIP_TOAST.success);
        } catch {
            sileo.error(EXPORT_ZIP_TOAST.error);
        }
    }, [documentId, exportZip, latexDocument?.title]);

    const handleExportPdf = useCallback(async (): Promise<void> => {
        const safeName = (latexDocument?.title ?? 'document').replace(/[^a-zA-Z0-9._-]+/g, '-');
        const blob = compiledPdfBlob ?? await compileSilently();
        if (!blob) {
            sileo.error({ title: 'Failed to export PDF' });
            return;
        }

        triggerBrowserDownload(blob, `${safeName}.pdf`);
    }, [compileSilently, compiledPdfBlob, latexDocument?.title]);

    const handleSelectFileById = useCallback((fileId: string): void => {
        const file = latexFiles.find((currentFile) => currentFile._id === fileId);
        if (file) {
            handleFileSelected(file);
            if (isTexFile(file.name) && !file.isEntrypoint) {
                void handleSetEntrypoint(file._id);
            }
        }
    }, [handleFileSelected, handleSetEntrypoint, isTexFile, latexFiles]);

    const handleSelectAssetById = useCallback((assetId: string): void => {
        const asset = assets.find((currentAsset) => currentAsset._id === assetId);
        if (asset) {
            handleOpenTab({ type: 'asset', id: asset._id });
        }
    }, [assets, handleOpenTab]);

    const handleUploadWorkspaceEntries = useCallback(async (entries: Array<{ file: File; path: string }>) => {
        const textEntries = entries.filter((entry) => isWorkspaceTextLikeFile(entry.path, entry.file.type));
        const binaryEntries = entries.filter((entry) => !isWorkspaceTextLikeFile(entry.path, entry.file.type));

        isBatchUploadingRef.current = true;
        pendingCompileAfterBatchRef.current = false;

        try {
            for (const entry of textEntries) {
                const { path, name } = (() => {
                    const normalized = entry.path.replace(/\\/g, '/').replace(/^\/+/, '');
                    const index = normalized.lastIndexOf('/');
                    return {
                        path: index >= 0 ? normalized.slice(0, index + 1) : '',
                        name: index >= 0 ? normalized.slice(index + 1) : normalized
                    };
                })();

                await handleCreateFile(name, path || undefined, await entry.file.text());
            }

            if (binaryEntries.length > 0) {
                await handleUploadEntries(binaryEntries);
            }
        } finally {
            isBatchUploadingRef.current = false;

            if (pendingCompileAfterBatchRef.current) {
                pendingCompileAfterBatchRef.current = false;
                void compileSilently();
            }
        }
    }, [compileSilently, handleCreateFile, handleUploadEntries]);

    const handleWorkspaceFilesSelected = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files;
        if (!fileList || fileList.length === 0) {
            return;
        }

        const entries = Array.from(fileList).map((file) => ({
            file,
            path: file.name
        }));
        event.target.value = '';

        await handleUploadWorkspaceEntries(entries);
    }, [handleUploadWorkspaceEntries]);

    const handleWorkspaceFoldersSelected = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files;
        if (!fileList || fileList.length === 0) {
            return;
        }

        const entries = Array.from(fileList).map((file) => ({
            file,
            path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
        }));
        event.target.value = '';

        await handleUploadWorkspaceEntries(entries);
    }, [handleUploadWorkspaceEntries]);

    const files = useMemo<LatexFileEntry[]>(
        () => latexFiles.map((file) => ({
            _id: file._id,
            name: file.name,
            path: file.path,
            content: file.content,
            isEntrypoint: isTexFile(file.name) && file.isEntrypoint,
            isSelected: selection?.type === 'file' && selection.id === file._id
        })),
        [isTexFile, latexFiles, selection]
    );

    return {
        latexDocument,
        documentId,
        isLoading: isLoading || isLoadingFiles,
        activeFile,
        activeAsset,
        selection,
        openTabs,
        editorContent,
        isDirty,
        dirtyFileIds,
        isSaving,
        isUploading,
        isExportingTex,
        isExportingZip,
        isCompiling,
        compiledPdfUrl,
        compileError,
        accessDenied,
        accessDeniedMessage,
        files,
        assets,
        rawAssets,
        collaborators,
        fileInputRef,
        folderInputRef,
        handleEditorChange,
        handleRenameDocument,
        handleExportTex,
        handleExportZip,
        handleExportPdf,
        handleCompile: compileSilently,
        handleSelectFileById,
        handleSelectAssetById,
        handleSelectTab,
        handleCloseTab,
        handleCreateFile,
        handleCreateFolder,
        handleDeleteFile,
        deleteFile,
        handleDeleteAsset,
        deleteAsset,
        updateFile,
        updateAsset,
        handleSetEntrypoint,
        handleMoveFile,
        handleMoveAsset,
        handleRenameFile,
        handleRenameAsset,
        handleInsertAssetRef,
        handleUploadWorkspaceEntries,
        handleWorkspaceFilesSelected,
        handleWorkspaceFoldersSelected
    };
};

export default useLatexWorkspace;
