import { latexFilesQuery, useCreateLatexFileMutation, useDeleteLatexFileMutation, useSetLatexFileEntrypointMutation, useUpdateLatexFileMutation } from '@/modules/latex/hooks/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useCallback } from 'react';
import type { LatexFile } from '@/modules/latex/api/entities/latex-file';

interface UseLatexFilesInput {
    documentId: string;
    onFileSelected?: (file: LatexFile) => void;
};

const CREATE_FILE_TOAST = {
    loading: { title: 'Creating file...' },
    success: { title: 'File created' },
    error: { title: 'Failed to create file' }
};

const DELETE_FILE_TOAST = {
    loading: { title: 'Deleting file...' },
    success: { title: 'File deleted' },
    error: { title: 'Failed to delete file' }
};

const SET_ENTRYPOINT_TOAST = {
    loading: { title: 'Setting entrypoint...' },
    success: { title: 'Entrypoint updated' },
    error: { title: 'Failed to set entrypoint' }
};

const RENAME_FILE_TOAST = {
    loading: { title: 'Renaming file...' },
    success: { title: 'File renamed' },
    error: { title: 'Failed to rename file' }
};

/**
 * Manages the list of LatexFile records for a document.
 * Provides handlers for creating, deleting, setting the entrypoint, and moving files.
 */
const useLatexFiles = ({ documentId, onFileSelected }: UseLatexFilesInput) => {
    const filesQueryResult = latexFilesQuery(
        { documentId },
        { enabled: !!documentId }
    );

    const files = filesQueryResult.data ?? [];
    const isLoading = filesQueryResult.isLoading;

    const { mutateAsync: createFile, isPending: isCreating } = useCreateLatexFileMutation();
    const { mutateAsync: deleteFile, isPending: isDeleting } = useDeleteLatexFileMutation();
    const { mutateAsync: setEntrypoint } = useSetLatexFileEntrypointMutation();
    const { mutateAsync: updateFile, isPending: isSaving } = useUpdateLatexFileMutation();

    const createFileWithoutSelection = useCallback(async (
        name: string,
        path?: string,
        content?: string
    ): Promise<LatexFile | null> => {
        if (!name.trim()) return null;

        return await createFile({ documentId, name: name.trim(), path, content });
    }, [createFile, documentId]);

    const handleCreateFile = useCallback(async (
        name: string,
        path?: string,
        content?: string
    ): Promise<LatexFile | null> => {
        const created = await showPromise(
            createFileWithoutSelection(name, path, content),
            CREATE_FILE_TOAST
        );

        if (created) {
            onFileSelected?.(created);
        }

        return created ?? null;
    }, [createFileWithoutSelection, onFileSelected]);

    const handleDeleteFile = useCallback(async (fileId: string): Promise<void> => {
        await showPromise(
            deleteFile({ documentId, fileId }),
            DELETE_FILE_TOAST
        );
    }, [deleteFile, documentId]);

    const handleSetEntrypoint = useCallback(async (fileId: string): Promise<void> => {
        await showPromise(
            setEntrypoint({ documentId, fileId }),
            SET_ENTRYPOINT_TOAST
        );
    }, [setEntrypoint, documentId]);

    const handleRenameFile = useCallback(async (fileId: string, name: string): Promise<void> => {
        await showPromise(
            updateFile({ documentId, fileId, name }),
            RENAME_FILE_TOAST
        );
    }, [documentId, updateFile]);

    return {
        files,
        isLoading,
        isCreating,
        isDeleting,
        isSaving,
        handleCreateFile,
        createFileWithoutSelection,
        handleDeleteFile,
        handleSetEntrypoint,
        handleRenameFile,
        deleteFile,
        updateFile
    };
};

export default useLatexFiles;
