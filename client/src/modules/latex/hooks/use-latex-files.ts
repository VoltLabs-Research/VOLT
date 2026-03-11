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

const MOVE_FILE_TOAST = {
    loading: { title: 'Moving file...' },
    success: { title: 'File moved' },
    error: { title: 'Failed to move file' }
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
    const { mutateAsync: updateFile } = useUpdateLatexFileMutation();

    const handleCreateFile = useCallback(async (name: string, path?: string): Promise<LatexFile | null> => {
        if (!name.trim()) return null;

        const created = await showPromise(
            createFile({ documentId, name: name.trim(), path }),
            CREATE_FILE_TOAST
        );

        if (created) {
            onFileSelected?.(created);
        }

        return created ?? null;
    }, [createFile, documentId, onFileSelected]);

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

    /**
     * Moves a file to a new folder by updating its `path` prefix.
     *
     * @param fileId    - The ID of the file to move.
     * @param newPath   - Target directory prefix, e.g. `"chapters/"` or `""` for root.
     */
    const handleMoveFile = useCallback(async (fileId: string, newPath: string): Promise<void> => {
        await showPromise(
            updateFile({ documentId, fileId, path: newPath }),
            MOVE_FILE_TOAST
        );
    }, [documentId, updateFile]);

    return {
        files,
        isLoading,
        isCreating,
        isDeleting,
        handleCreateFile,
        handleDeleteFile,
        handleSetEntrypoint,
        handleMoveFile
    };
};

export default useLatexFiles;
