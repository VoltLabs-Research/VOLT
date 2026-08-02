import useLatexAssets from '@/modules/latex/hooks/use-latex-assets';
import useLatexFiles from '@/modules/latex/hooks/use-latex-files';
import { latexDocumentQuery, useUpdateLatexDocumentMutation } from '@/modules/latex/hooks/queries';
import useLatexAutoCompile from '@/modules/latex/hooks/workspace/use-latex-auto-compile';
import useLatexAutosave from '@/modules/latex/hooks/workspace/use-latex-autosave';
import useLatexCollaborativeEditing from '@/modules/latex/hooks/workspace/use-latex-collaborative-editing';
import useLatexCompile from '@/modules/latex/hooks/workspace/use-latex-compile';
import useLatexEditorGroups from '@/modules/latex/hooks/workspace/use-latex-editor-groups';
import useLatexExport from '@/modules/latex/hooks/workspace/use-latex-export';
import useLatexFileEditorStates from '@/modules/latex/hooks/workspace/use-latex-file-editor-states';
import useLatexWorkspaceUpload from '@/modules/latex/hooks/workspace/use-latex-workspace-upload';
import { isTexFile } from '@/modules/latex/hooks/workspace/editor-helpers';
import { RENAME_TOAST } from '@/modules/latex/hooks/workspace/toasts';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useAccessDenied from '@/shared/ui/hooks/use-access-denied';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sileo } from 'sileo';

import type { LatexEditorGroupId, LatexFileEntry } from '@/modules/latex/contracts/workspace';
import type { LatexFile } from '@volt/contracts/modules/latex/domain';

interface UseLatexWorkspaceInput{
    documentId: string;
}

/**
 * Composition root of the LaTeX workspace. Owns nothing itself: it wires the
 * document query, the file and asset stores, the editor buffers, the tab groups,
 * collaboration, autosave, compilation and exports into the single object the
 * workspace page renders from.
 */
const useLatexWorkspace = ({ documentId }: UseLatexWorkspaceInput) => {
    const teamId = useSelectedTeamId();
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();
    const [isWorkspaceImportInProgress, setIsWorkspaceImportInProgress] = useState(false);

    const documentQueryResult = latexDocumentQuery({ documentId }, { enabled: !!documentId });
    const latexDocument = documentQueryResult.data;
    const { mutateAsync: updateDocument } = useUpdateLatexDocumentMutation();

    const {
        files: latexFiles,
        isLoading: isLoadingFiles,
        isSaving,
        handleCreateFile: createFileWithToast,
        createFileWithoutSelection,
        handleDeleteFile,
        handleSetEntrypoint,
        handleRenameFile,
        deleteFile,
        updateFile
    } = useLatexFiles({ documentId });

    const {
        assets,
        rawAssets,
        isUploading,
        fileInputRef,
        folderInputRef,
        uploadEntriesWithoutToast,
        handleDeleteAsset,
        handleRenameAsset,
        handleCreateFolder,
        deleteAsset,
        updateAsset
    } = useLatexAssets({ documentId });

    const editorStates = useLatexFileEditorStates(latexFiles);
    const groups = useLatexEditorGroups({
        files: latexFiles,
        assets,
        fileEditorStatesRef: editorStates.fileEditorStatesRef
    });

    const {
        compileSilently,
        compiledPdfUrl,
        compiledPdfBlob,
        compileError,
        isCompiling
    } = useLatexCompile({
        documentId,
        hasCompilableTexFile: latexFiles.some((file) => isTexFile(file.name))
    });

    const { scheduleLiveCompile } = useLatexAutoCompile({
        documentId,
        files: latexFiles,
        isWorkspaceSettled: !documentQueryResult.isLoading
            && !isLoadingFiles
            && !isWorkspaceImportInProgress
            && !!latexDocument,
        compileSilently
    });

    const { clearAutosaveTimer, scheduleFileAutosave } = useLatexAutosave({
        documentId,
        files: latexFiles,
        fileEditorStatesRef: editorStates.fileEditorStatesRef,
        commitSavedContent: editorStates.commitSavedContent,
        updateFile,
        compileSilently,
        checkAccessDeniedError
    });

    const {
        collaborators,
        applyFileContentUpdate,
        applyPendingRemoteUpdate,
        dismissPendingRemoteUpdate
    } = useLatexCollaborativeEditing({
        documentId,
        teamId: teamId ?? undefined,
        files: latexFiles,
        openCollaborativeFileIds: groups.openCollaborativeFileIds,
        editorStates,
        clearAutosaveTimer,
        scheduleFileAutosave,
        scheduleLiveCompile
    });

    const {
        isExportingTex,
        isExportingZip,
        handleExportTex,
        handleExportZip,
        handleExportPdf
    } = useLatexExport({
        documentId,
        documentTitle: latexDocument?.title,
        compiledPdfBlob,
        compileSilently
    });

    const runWorkspaceImport = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
        setIsWorkspaceImportInProgress(true);

        try {
            return await operation();
        } finally {
            setIsWorkspaceImportInProgress(false);
        }
    }, []);

    const {
        handleUploadWorkspaceEntries,
        handleWorkspaceFilesSelected,
        handleWorkspaceFoldersSelected
    } = useLatexWorkspaceUpload({
        runWorkspaceImport,
        createFileWithoutSelection,
        uploadEntriesWithoutToast
    });

    const { seedFileState } = editorStates;
    const { editorGroupsState, handleFocusEditorGroup, handleOpenTab, selection } = groups;

    const handleFileSelected = useCallback((file: LatexFile): void => {
        seedFileState(file._id, file.content);
        handleOpenTab({
            type: 'file',
            id: file._id
        });
    }, [handleOpenTab, seedFileState]);

    const handleCreateFile = useCallback(async (name: string, path?: string, content?: string): Promise<LatexFile | null> => {
        const created = await createFileWithToast(name, path, content);
        if (created) {
            handleFileSelected(created);
        }

        return created;
    }, [createFileWithToast, handleFileSelected]);

    const handleSelectFileById = useCallback((fileId: string): void => {
        const file = latexFiles.find((currentFile) => currentFile._id === fileId);
        if (file) {
            handleFileSelected(file);
        }
    }, [handleFileSelected, latexFiles]);

    const handleSelectAssetById = useCallback((assetId: string): void => {
        handleOpenTab({
            type: 'asset',
            id: assetId
        });
    }, [handleOpenTab]);

    const handleEditorChangeForGroup = useCallback((groupId: LatexEditorGroupId, value: string | undefined): void => {
        applyFileContentUpdate(editorGroupsState[groupId].selection, value ?? '');
        handleFocusEditorGroup(groupId);
    }, [applyFileContentUpdate, editorGroupsState, handleFocusEditorGroup]);

    const handleInsertAssetRef = useCallback((ref: string): void => {
        if (selection?.type !== 'file') return;

        const file = latexFiles.find((currentFile) => currentFile._id === selection.id);
        if (!file) return;

        const currentContent = editorStates.fileEditorStatesRef.current[file._id]?.content ?? file.content;
        applyFileContentUpdate(selection, `${currentContent}\n${ref}`);
    }, [applyFileContentUpdate, editorStates.fileEditorStatesRef, latexFiles, selection]);

    const handleRenameDocument = useCallback(async (title: string): Promise<void> => {
        try {
            await updateDocument({
                documentId,
                title
            });
            sileo.success(RENAME_TOAST.success);
        } catch (error) {
            checkAccessDeniedError(error);
            sileo.error(RENAME_TOAST.error);
        }
    }, [checkAccessDeniedError, documentId, updateDocument]);

    const files = useMemo<LatexFileEntry[]>(
        () => latexFiles.map((file) => ({
            _id: file._id,
            name: file.name,
            path: file.path,
            content: file.content,
            isEntrypoint: isTexFile(file.name) && file.isEntrypoint,
            isSelected: selection?.type === 'file' && selection.id === file._id
        })),
        [latexFiles, selection]
    );

    useEffect(() => {
        if (documentQueryResult.error) {
            checkAccessDeniedError(documentQueryResult.error);
        }
    }, [checkAccessDeniedError, documentQueryResult.error]);

    /**
     * A file that appears on its own - a collaborator's upload, an unzipped import -
     * is opened for the user. Imports are skipped so a 40-file archive does not
     * fight the tab bar.
     */
    const previousFileIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const currentIds = new Set(latexFiles.map((file) => file._id));
        const previousIds = previousFileIdsRef.current;
        previousFileIdsRef.current = currentIds;

        if (isWorkspaceImportInProgress || previousIds.size === 0) {
            return;
        }

        const appearedFile = latexFiles.find((file) => !previousIds.has(file._id));
        if (appearedFile) {
            handleFileSelected(appearedFile);
        }
    }, [handleFileSelected, isWorkspaceImportInProgress, latexFiles]);

    return {
        latexDocument,
        isLoading: documentQueryResult.isLoading || isLoadingFiles,
        activeEditorGroupId: groups.activeEditorGroupId,
        isEditorSplit: groups.isEditorSplit,
        editorGroups: groups.editorGroups,
        isDirty: editorStates.dirtyFileIds.length > 0,
        dirtyFileIds: editorStates.dirtyFileIds,
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
        rawAssets,
        selectedAssetId: selection?.type === 'asset' ? selection.id : null,
        collaborators,
        fileInputRef,
        folderInputRef,
        handleEditorChangeForGroup,
        handleRenameDocument,
        handleExportTex,
        handleExportZip,
        handleExportPdf,
        handleCompile: compileSilently,
        getEditorContentForSelection: editorStates.getEditorContentForSelection,
        getPendingRemoteUpdateForSelection: editorStates.getPendingRemoteUpdateForSelection,
        applyPendingRemoteUpdate,
        dismissPendingRemoteUpdate,
        handleFocusEditorGroup,
        handleSelectFileById,
        handleSelectAssetById,
        handleSelectTab: groups.handleSelectTab,
        handleCloseTab: groups.handleCloseTab,
        handleSplitEditorDown: groups.handleSplitEditorDown,
        handleDuplicateTabToOtherGroup: groups.handleDuplicateTabToOtherGroup,
        handleCloseSecondaryEditorGroup: groups.handleCloseSecondaryEditorGroup,
        handleReorderTabs: groups.handleReorderTabs,
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
