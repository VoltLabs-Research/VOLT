import useLatexAssets from '@/modules/latex/hooks/use-latex-assets';
import useLatexDocumentSocket from '@/modules/latex/hooks/use-latex-document-socket';
import useLatexFiles from '@/modules/latex/hooks/use-latex-files';
import { invalidateLatexFilesQuery, latexDocumentQuery, useCompileLatexDocumentMutation, useExportLatexDocumentTexMutation, useExportLatexDocumentZipMutation, useUpdateLatexDocumentMutation } from '@/modules/latex/hooks/queries';
import { isWorkspaceTextLikeFile } from '@/modules/latex/utilities/workspace';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sileo } from 'sileo';
import type { ChangeEvent } from 'react';
import type { LatexFile } from '@/modules/latex/api/entities/latex-file';

interface UseLatexWorkspaceInput {
    documentId: string;
};

export interface LatexFileEntry {
    _id: string;
    name: string;
    path: string;
    content: string;
    isEntrypoint: boolean;
    isSelected: boolean;
};

interface LatexWorkspaceFileSelection {
    type: 'file';
    id: string;
};

interface LatexWorkspaceAssetSelection {
    type: 'asset';
    id: string;
};

interface WorkspaceUploadEntry {
    file: File;
    path: string;
};

export type LatexWorkspaceSelection =
    | LatexWorkspaceFileSelection
    | LatexWorkspaceAssetSelection
    | null;

export type LatexWorkspaceTab = LatexWorkspaceFileSelection | LatexWorkspaceAssetSelection;

interface FileEditorState {
    content: string;
    lastSavedContent: string;
    remoteContent: string;
    isDirty: boolean;
};

interface PendingRemoteFileUpdate {
    content: string;
    timestamp: number;
};

const AUTOSAVE_DELAY = 500;
const TEX_EXTENSION = '.tex';

const createFileEditorState = (content: string): FileEditorState => ({
    content,
    lastSavedContent: content,
    remoteContent: content,
    isDirty: false
});

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
    const [pendingRemoteUpdates, setPendingRemoteUpdates] = useState<Record<string, PendingRemoteFileUpdate>>({});
    const [compiledPdfUrl, setCompiledPdfUrl] = useState<string | null>(null);
    const [compiledPdfBlob, setCompiledPdfBlob] = useState<Blob | null>(null);
    const [compileError, setCompileError] = useState<string | null>(null);

    const fileEditorStatesRef = useRef<Record<string, FileEditorState>>({});
    const sendContentUpdateRef = useRef<((content: string, fileId?: string) => void) | null>(null);
    const compiledPdfUrlRef = useRef<string | null>(null);
    const autosaveTimersRef = useRef<Record<string, number>>({});
    const lastTexWorkspaceFingerprintRef = useRef<string | null>(null);
    const compileRequestIdRef = useRef(0);
    const hasBootstrappedSelectionRef = useRef(false);

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
        setOpenTabs((currentTabs) => currentTabs.some(
            (currentTab) => currentTab.type === tab.type && currentTab.id === tab.id
        )
            ? currentTabs
            : [...currentTabs, tab]);
        setSelection(tab);
    }, []);

    const handleSelectTab = useCallback((tab: LatexWorkspaceTab): void => {
        setSelection(tab);
    }, []);

    const handleCloseTab = useCallback((tabToClose: LatexWorkspaceTab): void => {
        setOpenTabs((currentTabs) => {
            const tabIndex = currentTabs.findIndex(
                (currentTab) => currentTab.type === tabToClose.type && currentTab.id === tabToClose.id
            );
            if (tabIndex < 0) {
                return currentTabs;
            }

            const nextTabs = currentTabs.filter((_, index) => index !== tabIndex);
            setSelection((currentSelection) => {
                if (
                    !currentSelection
                    || currentSelection.type !== tabToClose.type
                    || currentSelection.id !== tabToClose.id
                ) {
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

    const revokePdfUrl = (): void => {
        if (compiledPdfUrlRef.current) {
            URL.revokeObjectURL(compiledPdfUrlRef.current);
            compiledPdfUrlRef.current = null;
        }
    };

    const compileSilently = useCallback(async (): Promise<Blob | null> => {
        const requestId = ++compileRequestIdRef.current;
        const isStale = () => requestId !== compileRequestIdRef.current;

        if (!documentId) return null;

        if (!hasCompilableTexFile) {
            if (isStale()) return null;

            revokePdfUrl();
            setCompiledPdfBlob(null);
            setCompiledPdfUrl(null);
            setCompileError('Add a .tex file to generate the PDF preview.');
            return null;
        }

        setCompileError(null);

        try {
            const blob = await compileDocument({ documentId });

            if (isStale()) return null;

            revokePdfUrl();

            const pdfUrl = URL.createObjectURL(blob);
            compiledPdfUrlRef.current = pdfUrl;
            setCompiledPdfBlob(blob);
            setCompiledPdfUrl(pdfUrl);
            return blob;
        } catch (error) {
            if (isStale()) return null;

            revokePdfUrl();

            setCompiledPdfBlob(null);
            setCompiledPdfUrl(null);
            let message = reportError(error, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Compilation failed'
            }).title;
            const response = typeof error === 'object'
                && error !== null
                && 'response' in error
                && typeof error.response === 'object'
                && error.response !== null
                ? error.response
                : null;
            const data = response && 'data' in response ? response.data : null;

            if (data instanceof Blob) {
                try {
                    const text = await data.text();
                    let blobMessage = text.trim();

                    try {
                        const parsed = JSON.parse(text);
                        if (typeof parsed === 'object' && parsed !== null) {
                            if ('logs' in parsed && typeof parsed.logs === 'string' && parsed.logs.trim()) {
                                blobMessage = parsed.logs;
                            } else if ('message' in parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
                                blobMessage = parsed.message;
                            } else if ('error' in parsed && typeof parsed.error === 'string' && parsed.error.trim()) {
                                blobMessage = parsed.error;
                            }
                        }
                    } catch {
                        // Keep the raw blob text when it is not JSON.
                    }

                    if (blobMessage) {
                        message = blobMessage;
                    }
                } catch {
                    // Keep the shared fallback error message when the blob cannot be read.
                }
            }

            setCompileError(message);
            return null;
        }
    }, [compileDocument, documentId, hasCompilableTexFile]);

    const clearAutosaveTimer = useCallback((fileId: string): void => {
        const existingTimer = autosaveTimersRef.current[fileId];
        if (!existingTimer) {
            return;
        }

        window.clearTimeout(existingTimer);
        delete autosaveTimersRef.current[fileId];
    }, []);

    const applyRemoteFileContent = useCallback((fileId: string, content: string): void => {
        clearAutosaveTimer(fileId);
        setPendingRemoteUpdates((currentUpdates) => {
            if (!(fileId in currentUpdates)) {
                return currentUpdates;
            }

            const nextUpdates = { ...currentUpdates };
            delete nextUpdates[fileId];
            return nextUpdates;
        });
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
    }, [clearAutosaveTimer]);

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
            const saveFile = async (): Promise<void> => {
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

                    await compileSilently();
                } catch (error) {
                    checkAccessDeniedError(error);
                    sileo.error({ title: 'Failed to save file' });
                } finally {
                    delete autosaveTimersRef.current[fileId];
                }
            };

            saveFile();
        }, AUTOSAVE_DELAY);
    }, [checkAccessDeniedError, compileSilently, documentId, updateFile]);

    const applyFileContentUpdate = useCallback((content: string): void => {
        if (!selection || selection.type !== 'file') return;
        const file = latexFiles.find((currentFile) => currentFile._id === selection.id);
        if (!file) return;
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
        if (!isRemoteEcho) sendContentUpdateRef.current?.(content, file._id);
        scheduleFileAutosave(file._id, content);
    }, [latexFiles, scheduleFileAutosave, selection]);

    const handleInsertAssetRef = useCallback((ref: string): void => {
        if (!selection || selection.type !== 'file') return;
        const file = latexFiles.find((currentFile) => currentFile._id === selection.id);
        if (!file) return;
        const currentState = fileEditorStatesRef.current[file._id] ?? createFileEditorState(file.content);
        applyFileContentUpdate(`${currentState.content}\n${ref}`);
    }, [applyFileContentUpdate, latexFiles, selection]);

    const {
        assets,
        rawAssets,
        isUploading,
        fileInputRef,
        folderInputRef,
        handleUploadEntries,
        handleDeleteAsset,
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

    const selectedAssetId = selection?.type === 'asset' ? selection.id : null;

    const handleRemoteContentUpdate = useCallback((content: string, _timestamp: number, fileId?: string): void => {
        if (!fileId) {
            return;
        }

        if (!latexFileIdsRef.current.has(fileId)) {
            invalidateLatexFilesQuery({ documentId });
            return;
        }

        setFileEditorStates((currentStates) => {
            const currentState = currentStates[fileId] ?? createFileEditorState(content);
            const hasConflict = currentState.isDirty && currentState.content !== content;

            if (hasConflict) {
                setPendingRemoteUpdates((currentUpdates) => ({
                    ...currentUpdates,
                    [fileId]: {
                        content,
                        timestamp: _timestamp
                    }
                }));
                return currentStates;
            }

            clearAutosaveTimer(fileId);
            setPendingRemoteUpdates((currentUpdates) => {
                if (!(fileId in currentUpdates)) {
                    return currentUpdates;
                }

                const nextUpdates = { ...currentUpdates };
                delete nextUpdates[fileId];
                return nextUpdates;
            });

            return {
                ...currentStates,
                [fileId]: {
                    ...currentState,
                    content,
                    lastSavedContent: content,
                    remoteContent: content,
                    isDirty: false
                }
            };
        });
    }, [clearAutosaveTimer, documentId]);

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
    const activePendingRemoteUpdate = activeFile ? pendingRemoteUpdates[activeFile._id] ?? null : null;

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
            revokePdfUrl();

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

    useEffect(() => {
        const nextFileIds = new Set(latexFiles.map((file) => file._id));

        setPendingRemoteUpdates((currentUpdates) => {
            let hasChanges = false;
            const nextUpdates: Record<string, PendingRemoteFileUpdate> = {};

            Object.entries(currentUpdates).forEach(([fileId, update]) => {
                if (!nextFileIds.has(fileId)) {
                    hasChanges = true;
                    return;
                }

                nextUpdates[fileId] = update;
            });

            return hasChanges ? nextUpdates : currentUpdates;
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
            setSelection(validOpenTabs[validOpenTabs.length - 1] ?? null);
            return;
        }

        if (!selection && validOpenTabs.length > 0) {
            setSelection(validOpenTabs[validOpenTabs.length - 1] ?? null);
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

        compileSilently();
    }, [compileSilently, isLoading, isLoadingFiles, latexDocument, texWorkspaceFingerprint]);

    const handleEditorChange = useCallback((value: string | undefined): void => {
        applyFileContentUpdate(value ?? '');
    }, [applyFileContentUpdate]);

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

        try {
            const blob = await showPromise(exportTex({ documentId }), EXPORT_TEX_TOAST);
            const downloadName = `${(latexDocument?.title ?? 'document').replace(/[^a-zA-Z0-9._-]+/g, '-')}.tex`;
            triggerBrowserDownload(blob, downloadName);
        } catch {
            return;
        }
    }, [documentId, exportTex, latexDocument?.title]);

    const handleExportZip = useCallback(async (): Promise<void> => {
        if (!documentId) return;

        try {
            const blob = await showPromise(exportZip({ documentId }), EXPORT_ZIP_TOAST);
            const downloadName = `${(latexDocument?.title ?? 'document').replace(/[^a-zA-Z0-9._-]+/g, '-')}.zip`;
            triggerBrowserDownload(blob, downloadName);
        } catch {
            return;
        }
    }, [documentId, exportZip, latexDocument?.title]);

    const handleExportPdf = useCallback(async (): Promise<void> => {
        const blob = compiledPdfBlob ?? await compileSilently();
        if (!blob) {
            sileo.error({ title: 'Failed to export PDF' });
            return;
        }

        const downloadName = `${(latexDocument?.title ?? 'document').replace(/[^a-zA-Z0-9._-]+/g, '-')}.pdf`;
        triggerBrowserDownload(blob, downloadName);
    }, [compileSilently, compiledPdfBlob, latexDocument?.title]);

    const handleSelectFileById = useCallback((fileId: string): void => {
        const file = latexFiles.find((currentFile) => currentFile._id === fileId);
        if (file) {
            handleFileSelected(file);
            if (isTexFile(file.name) && !file.isEntrypoint) {
                handleSetEntrypoint(file._id).catch(() => undefined);
            }
        }
    }, [handleFileSelected, handleSetEntrypoint, isTexFile, latexFiles]);

    const handleSelectAssetById = useCallback((assetId: string): void => {
        const asset = assets.find((currentAsset) => currentAsset._id === assetId);
        if (asset) {
            handleOpenTab({ type: 'asset', id: asset._id });
        }
    }, [assets, handleOpenTab]);

    const handleUploadWorkspaceEntries = useCallback(async (entries: WorkspaceUploadEntry[]) => {
        const textEntries = entries.filter((entry) => isWorkspaceTextLikeFile(entry.path, entry.file.type));
        const binaryEntries = entries.filter((entry) => !isWorkspaceTextLikeFile(entry.path, entry.file.type));

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
    }, [handleCreateFile, handleUploadEntries]);

    const handleWorkspaceFilesSelected = useCallback(async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
        const fileList = event.target.files;
        if (!fileList || fileList.length === 0) return;

        const entries: WorkspaceUploadEntry[] = Array.from(fileList).map((file) => ({
            file,
            path: file.name
        }));

        event.target.value = '';
        await handleUploadWorkspaceEntries(entries);
    }, [handleUploadWorkspaceEntries]);

    const handleWorkspaceFoldersSelected = useCallback(async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
        const fileList = event.target.files;
        if (!fileList || fileList.length === 0) return;

        const entries: WorkspaceUploadEntry[] = Array.from(fileList).map((file) => {
            let path = file.name;
            if ('webkitRelativePath' in file && typeof file.webkitRelativePath === 'string' && file.webkitRelativePath) {
                path = file.webkitRelativePath;
            }

            return {
                file,
                path
            };
        });

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

    const applyPendingRemoteUpdate = useCallback((fileId: string): void => {
        const pendingUpdate = pendingRemoteUpdates[fileId];
        if (!pendingUpdate) {
            return;
        }

        applyRemoteFileContent(fileId, pendingUpdate.content);
    }, [applyRemoteFileContent, pendingRemoteUpdates]);

    const dismissPendingRemoteUpdate = useCallback((fileId: string): void => {
        setPendingRemoteUpdates((currentUpdates) => {
            if (!(fileId in currentUpdates)) {
                return currentUpdates;
            }

            const nextUpdates = { ...currentUpdates };
            delete nextUpdates[fileId];
            return nextUpdates;
        });
    }, []);

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
        activePendingRemoteUpdate,
        accessDenied,
        accessDeniedMessage,
        files,
        assets,
        rawAssets,
        selectedAssetId,
        collaborators,
        fileInputRef,
        folderInputRef,
        handleEditorChange,
        handleRenameDocument,
        handleExportTex,
        handleExportZip,
        handleExportPdf,
        handleCompile: compileSilently,
        applyPendingRemoteUpdate,
        dismissPendingRemoteUpdate,
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
        handleRenameFile,
        handleRenameAsset,
        handleInsertAssetRef,
        handleUploadWorkspaceEntries,
        handleWorkspaceFilesSelected,
        handleWorkspaceFoldersSelected
    };
};

export default useLatexWorkspace;
