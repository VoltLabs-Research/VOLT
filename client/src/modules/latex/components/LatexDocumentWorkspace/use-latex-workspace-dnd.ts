import { canDropLatexWorkspaceItemInFolder } from '@/modules/latex/utils/workspace-dnd';
import { normalizeWorkspaceFolderPath } from '@/modules/latex/utils/workspace';
import { describeTargetFolder, extractDroppedEntries, hasFileTransfer } from './workspace-dropped-entries';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { describeSkippedEntries } from '@/shared/utils/file';
import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useEffect, useRef, useState } from 'react';
import { sileo } from 'sileo';
import type { LatexWorkspaceDragData, LatexWorkspaceDropData } from '@/modules/latex/utils/workspace-dnd';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { FileWithPath } from '@/shared/utils/file';
import type { DragEvent } from 'react';

interface UseLatexWorkspaceDndInput {
    onUploadEntries: (entries: FileWithPath[]) => Promise<void>;
    moveFileToFolder: (fileId: string, targetFolderPath: string) => Promise<boolean>;
    moveAssetToFolder: (assetId: string, targetFolderPath: string) => Promise<boolean>;
    moveFolderToFolder: (folderPath: string, targetFolderPath: string) => Promise<boolean>;
}

const ANNOUNCEMENT_TIMEOUT = 1800;

const notifyDndFailure = (error: unknown, fallbackTitle: string): void => {
    const userError = reportError(error, {
        surface: ErrorSurface.Silent,
        fallbackTitle
    });

    sileo.error({
        title: userError.title,
        description: userError.description
    });
};

/**
 * Owns every drag interaction of the workspace tree: dnd-kit moves between
 * folders and files dropped in from the operating system, plus the polite
 * announcements both produce.
*/
const useLatexWorkspaceDnd = ({
    onUploadEntries,
    moveFileToFolder,
    moveAssetToFolder,
    moveFolderToFolder
}: UseLatexWorkspaceDndInput) => {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 6
            }
        })
    );
    const [activeDragData, setActiveDragData] = useState<LatexWorkspaceDragData | null>(null);
    const [externalDropTargetPath, setExternalDropTargetPath] = useState<string | null>(null);
    const [interactionAnnouncement, setInteractionAnnouncement] = useState('');
    const announcementTimerRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (announcementTimerRef.current) {
                window.clearTimeout(announcementTimerRef.current);
            }
        };
    }, []);

    const announceInteraction = (message: string): void => {
        if (announcementTimerRef.current) {
            window.clearTimeout(announcementTimerRef.current);
        }

        setInteractionAnnouncement(message);
        announcementTimerRef.current = window.setTimeout(() => {
            setInteractionAnnouncement('');
        }, ANNOUNCEMENT_TIMEOUT);
    };

    const resetDragState = (): void => {
        setActiveDragData(null);
        setExternalDropTargetPath(null);
    };

    const handleExternalFilesDragOver = (targetFolderPath: string, event: DragEvent<HTMLElement>): void => {
        if (!hasFileTransfer(event)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy';
        setExternalDropTargetPath(normalizeWorkspaceFolderPath(targetFolderPath));
    };

    const handleExternalFilesDragLeave = (targetFolderPath: string, event: DragEvent<HTMLElement>): void => {
        if (!hasFileTransfer(event)) {
            return;
        }

        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
            return;
        }

        const normalizedTargetFolderPath = normalizeWorkspaceFolderPath(targetFolderPath);
        setExternalDropTargetPath((currentTargetPath) => currentTargetPath === normalizedTargetFolderPath
            ? null
            : currentTargetPath);
    };

    const handleExternalFilesDrop = async (targetFolderPath: string, event: DragEvent<HTMLElement>): Promise<void> => {
        if (!hasFileTransfer(event)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        setExternalDropTargetPath(null);

        try {
            const { files, skippedPaths } = await extractDroppedEntries(event, targetFolderPath);

            const skippedNotice = describeSkippedEntries(skippedPaths);
            if (skippedNotice) {
                sileo.error({
                    title: 'Some dropped items were skipped',
                    description: skippedNotice
                });
            }

            if (files.length === 0) {
                return;
            }

            await onUploadEntries(files);
            const itemLabel = files.length === 1
                ? files[0].file.name
                : `${files.length} files`;

            announceInteraction(`Added ${itemLabel} to ${describeTargetFolder(targetFolderPath)}.`);
        } catch (error) {
            notifyDndFailure(error, 'Failed to upload dropped files');
        }
    };

    const handleDragStart = (event: DragStartEvent): void => {
        setActiveDragData(event.active.data.current as LatexWorkspaceDragData | undefined ?? null);
    };

    const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
        const dragData = event.active.data.current as LatexWorkspaceDragData | undefined;
        const dropData = event.over?.data.current as LatexWorkspaceDropData | undefined;

        resetDragState();

        if (!dragData || !dropData || !canDropLatexWorkspaceItemInFolder(dragData, dropData.folderPath)) {
            return;
        }

        try {
            const moveItem = dragData.kind === 'file'
                ? moveFileToFolder
                : dragData.kind === 'asset'
                    ? moveAssetToFolder
                    : moveFolderToFolder;

            if (await moveItem(dragData.id, dropData.folderPath)) {
                announceInteraction(`Moved ${dragData.label} to ${dropData.label}.`);
            }
        } catch (error) {
            notifyDndFailure(error, 'Failed to move workspace item');
        }
    };

    return {
        sensors,
        activeDragData,
        externalDropTargetPath,
        interactionAnnouncement,
        handleDragStart,
        handleDragEnd,
        resetDragState,
        handleExternalFilesDragOver,
        handleExternalFilesDragLeave,
        handleExternalFilesDrop
    };
};

export default useLatexWorkspaceDnd;
