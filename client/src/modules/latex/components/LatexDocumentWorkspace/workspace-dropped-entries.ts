import { joinWorkspacePath } from '@/modules/latex/utils/workspace';
import { processFileSystemEntry } from '@/shared/utils/file';
import type { FileWithPath } from '@/shared/utils/file';
import type { DragEvent } from 'react';

type WebKitDataTransferItem = DataTransferItem & {
    webkitGetAsEntry?: () => FileSystemEntry | null;
};

export const ROOT_FOLDER_LABEL = 'Project root';

export const hasFileTransfer = (event: DragEvent<HTMLElement>): boolean => {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
};

export const describeTargetFolder = (folderPath: string): string => {
    return folderPath
        ? folderPath.replace(/\/$/, '')
        : ROOT_FOLDER_LABEL;
};

export interface DroppedEntries {
    files: FileWithPath[];
    skippedPaths: string[];
};

export const extractDroppedEntries = async (
    event: DragEvent<HTMLElement>,
    targetFolderPath: string
): Promise<DroppedEntries> => {
    const items = Array.from(event.dataTransfer.items ?? []);

    if (items.length === 0) {
        return {
            files: Array.from(event.dataTransfer.files ?? []).map((file) => ({
                file,
                path: joinWorkspacePath(targetFolderPath, file.name)
            })),
            skippedPaths: []
        };
    }

    const results = await Promise.all(items.map(async (item): Promise<DroppedEntries> => {
        if (item.kind !== 'file') {
            return { files: [], skippedPaths: [] };
        }

        const webkitItem = item as WebKitDataTransferItem;
        const entry = webkitItem.webkitGetAsEntry?.();

        if (entry) {
            const processed = await processFileSystemEntry(entry);
            return {
                files: processed.files,
                skippedPaths: processed.skippedPaths
            };
        }

        const file = item.getAsFile();
        return {
            files: file
                ? [{
                    file,
                    path: file.name
                }]
                : [],
            skippedPaths: []
        };
    }));

    return {
        files: results
            .flatMap((result) => result.files)
            .map((entry) => ({
                file: entry.file,
                path: joinWorkspacePath(targetFolderPath, entry.path)
            })),
        skippedPaths: results.flatMap((result) => result.skippedPaths)
    };
};
