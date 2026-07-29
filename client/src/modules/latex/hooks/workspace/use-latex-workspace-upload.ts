import { IMPORT_WORKSPACE_TOAST } from '@/modules/latex/hooks/workspace/toasts';
import { isWorkspaceTextLikeFile, splitWorkspacePath } from '@/modules/latex/utils/workspace';
import { showPromise } from '@/shared/ui/hooks/toast';
import { useCallback } from 'react';

import type { WorkspaceUploadEntry } from '@/modules/latex/contracts/workspace';
import type { ChangeEvent } from 'react';

interface UseLatexWorkspaceUploadInput{
    runWorkspaceImport: <T>(operation: () => Promise<T>) => Promise<T>;
    createFileWithoutSelection: (name: string, path: string | undefined, content: string) => Promise<unknown>;
    uploadEntriesWithoutToast: (entries: WorkspaceUploadEntry[]) => Promise<unknown>;
}

/** Folder pickers expose the nested path on a non-standard field. */
const resolveEntryPath = (file: File): string => {
    if('webkitRelativePath' in file
        && typeof file.webkitRelativePath === 'string'
        && file.webkitRelativePath){
        return file.webkitRelativePath;
    }
    return file.name;
};

const takeEntries = (
    event: ChangeEvent<HTMLInputElement>,
    toPath: (file: File) => string
): WorkspaceUploadEntry[] => {
    const fileList = event.target.files;
    if(!fileList || fileList.length === 0) return [];

    const entries = Array.from(fileList).map((file) => ({
        file,
        path: toPath(file)
    }));

    // Reset so picking the same file again still fires a change event.
    event.target.value = '';
    return entries;
};

/**
 * Imports dropped or picked files into the workspace, routing text-like files
 * through file creation and everything else through binary asset upload.
 */
const useLatexWorkspaceUpload = ({
    runWorkspaceImport,
    createFileWithoutSelection,
    uploadEntriesWithoutToast
}: UseLatexWorkspaceUploadInput) => {
    const handleUploadWorkspaceEntries = useCallback(async (entries: WorkspaceUploadEntry[]): Promise<void> => {
        await showPromise(
            runWorkspaceImport(async () => {
                const textEntries = entries.filter((entry) => isWorkspaceTextLikeFile(entry.path, entry.file.type));
                const binaryEntries = entries.filter((entry) => !isWorkspaceTextLikeFile(entry.path, entry.file.type));

                for(const entry of textEntries){
                    const { path, name } = splitWorkspacePath(entry.path);
                    await createFileWithoutSelection(name, path || undefined, await entry.file.text());
                }

                if(binaryEntries.length > 0) await uploadEntriesWithoutToast(binaryEntries);
            }),
            IMPORT_WORKSPACE_TOAST
        );
    }, [createFileWithoutSelection, runWorkspaceImport, uploadEntriesWithoutToast]);

    const handleWorkspaceFilesSelected = useCallback(async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
        const entries = takeEntries(event, (file) => file.name);
        if(entries.length > 0) await handleUploadWorkspaceEntries(entries);
    }, [handleUploadWorkspaceEntries]);

    const handleWorkspaceFoldersSelected = useCallback(async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
        const entries = takeEntries(event, resolveEntryPath);
        if(entries.length > 0) await handleUploadWorkspaceEntries(entries);
    }, [handleUploadWorkspaceEntries]);

    return {
        handleUploadWorkspaceEntries,
        handleWorkspaceFilesSelected,
        handleWorkspaceFoldersSelected
    };
};

export default useLatexWorkspaceUpload;
