import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useFileTree from '@/modules/latex/hooks/use-file-tree';
import { buildLatexRef } from '@/modules/latex/hooks/use-latex-assets';
import {
    canDropLatexWorkspaceItemInFolder,
    LATEX_WORKSPACE_ROOT_DROP_ID
} from '@/modules/latex/utilities/workspace-dnd';
import { joinWorkspacePath, normalizeWorkspaceFolderPath } from '@/modules/latex/utilities/workspace';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import ContextMenuPopover from '@/shared/presentation/primitives/ContextMenuPopover';
import FileExplorer from '@/shared/presentation/components/FileExplorer';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import Popover from '@/shared/presentation/primitives/Popover';
import PopoverMenu from '@/shared/presentation/primitives/PopoverMenu';
import PopoverMenuItem from '@/shared/presentation/primitives/PopoverMenuItem';
import IconButton from '@/shared/presentation/primitives/IconButton';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import FileTreeNode from './FileTreeNode';
import WorkspaceCreationInputs from './WorkspaceCreationInputs';
import { DndContext, PointerSensor, pointerWithin, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { cn } from '@/shared/utils';
import { processFileSystemEntry } from '@/shared/utils/file';
import { FilePlus, FolderOpen, FolderPlus, Upload } from 'lucide-react';
import { sileo } from 'sileo';
import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';
import type { LatexFileEntry } from '@/modules/latex/hooks/use-latex-workspace';
import type { LatexWorkspaceDragData, LatexWorkspaceDropData } from '@/modules/latex/utilities/workspace-dnd';
import type { FileTreeNode as FileTreeNodeType } from '@/modules/latex/utilities/file-tree';
import type { FileWithPath } from '@/shared/utils/file';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { ChangeEvent, DragEvent, MouseEvent, RefObject } from 'react';

interface LatexFilePanelProps {
    documentId: string;
    files: LatexFileEntry[];
    assets: LatexAsset[];
    folders?: string[];
    selectedAssetId: string | null;
    width: number;
    fileInputRef: RefObject<HTMLInputElement | null>;
    folderInputRef: RefObject<HTMLInputElement | null>;
    isUploading: boolean;
    onFileSelect: (fileId: string) => void;
    onAssetSelect: (assetId: string) => void;
    onCreateFile: (name: string, path?: string, content?: string) => Promise<unknown>;
    onCreateFolder: (folderPath: string) => Promise<void>;
    onDeleteFile: (fileId: string) => Promise<void>;
    onDeleteAsset: (asset: LatexAsset) => Promise<void>;
    onDeleteFileDirect: (input: { documentId: string; fileId: string }) => Promise<unknown>;
    onDeleteAssetDirect: (input: { documentId: string; assetId: string }) => Promise<unknown>;
    onUpdateFileDirect: (input: { documentId: string; fileId: string; path?: string; name?: string; content?: string }) => Promise<unknown>;
    onUpdateAssetDirect: (input: { documentId: string; assetId: string; path: string }) => Promise<unknown>;
    onMoveFolderDirect?: (sourceFolderPath: string, targetFolderPath: string) => Promise<unknown>;
    onDeleteFolderDirect?: (folderPath: string) => Promise<unknown>;
    onRenameFile: (fileId: string, name: string) => Promise<void>;
    onRenameAsset: (asset: LatexAsset, name: string) => Promise<void>;
    onSetEntrypoint: (fileId: string) => Promise<void>;
    onInsertRef: (ref: string) => void;
    onUploadEntries: (entries: FileWithPath[]) => Promise<void>;
    onUploadFiles: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
    onUploadFolders: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

type WebKitDataTransferItem = DataTransferItem & {
    webkitGetAsEntry?: () => FileSystemEntry | null;
};

const FOLDER_ICON = <FolderOpen size={14} />;
const ROOT_DROP_DATA: LatexWorkspaceDropData = {
    folderPath: '',
    label: 'Project root'
};

const hasFileTransfer = (event: DragEvent<HTMLElement>): boolean => {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
};

const describeTargetFolder = (folderPath: string): string => {
    return folderPath
        ? folderPath.replace(/\/$/, '')
        : ROOT_DROP_DATA.label;
};

interface RootDropLaneProps {
    id: string;
    isVisible: boolean;
    fillAvailableSpace?: boolean;
    isExternallyActive?: boolean;
    onExternalDragOver: (event: DragEvent<HTMLElement>) => void;
    onExternalDragLeave: (event: DragEvent<HTMLElement>) => void;
    onExternalDrop: (event: DragEvent<HTMLElement>) => Promise<void>;
}

const RootDropLane = ({
    id,
    isVisible,
    fillAvailableSpace = false,
    isExternallyActive = false,
    onExternalDragOver,
    onExternalDragLeave,
    onExternalDrop
}: RootDropLaneProps) => {
    const { setNodeRef, isOver } = useDroppable({
        id,
        data: ROOT_DROP_DATA
    });

    if (!isVisible) {
        return null;
    }

    return (
        <div ref={setNodeRef} className={cn(
                'latex-workspace__root-drop-lane d-flex items-center',
                fillAvailableSpace && 'is-fill-area',
                (isOver || isExternallyActive) && 'is-root-drop-target'
            )} aria-hidden='true' onDragOver={onExternalDragOver} onDragLeave={onExternalDragLeave} onDrop={(event) => {
                void onExternalDrop(event);
            }}>
            <span className='latex-workspace__root-drop-lane-line' />
        </div>
    );
};

const LatexFilePanel = ({
    documentId,
    files,
    assets,
    folders = [],
    selectedAssetId,
    width,
    fileInputRef,
    folderInputRef,
    isUploading,
    onFileSelect,
    onAssetSelect,
    onCreateFile,
    onCreateFolder,
    onDeleteFile,
    onDeleteAsset,
    onDeleteFileDirect,
    onDeleteAssetDirect,
    onUpdateFileDirect,
    onUpdateAssetDirect,
    onMoveFolderDirect,
    onDeleteFolderDirect,
    onRenameFile,
    onRenameAsset,
    onSetEntrypoint,
    onInsertRef,
    onUploadEntries,
    onUploadFiles,
    onUploadFolders
}: LatexFilePanelProps) => {
    const {
        treeNodes,
        expandedFolders,
        newFileTargetFolder,
        newFolderTargetFolder,
        renamingTarget,
        toggleFolder,
        openNewFileIn,
        closeNewFile,
        handleConfirmNewFile,
        openNewFolderIn,
        closeNewFolder,
        handleConfirmNewFolder,
        startRenameFolder,
        startRenameFile,
        startRenameAsset,
        renameFolder,
        cancelRename,
        handleDeleteFolder,
        moveFileToFolder,
        moveAssetToFolder,
        moveFolderToFolder
    } = useFileTree({
        files,
        assets,
        folderPaths: folders,
        onCreateFile,
        onCreateFolder,
        onRenameFile,
        onRenameAsset,
        onDeleteFileDirect,
        onDeleteAssetDirect,
        onUpdateFileDirect,
        onUpdateAssetDirect,
        onMoveFolderDirect,
        onDeleteFolderDirect,
        documentId
    });
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 6
            }
        })
    );
    const [activeDragData, setActiveDragData] = useState<LatexWorkspaceDragData | null>(null);
    const [externalDropTargetPath, setExternalDropTargetPath] = useState<string | null>(null);
    const [activeExternalRootLaneId, setActiveExternalRootLaneId] = useState<string | null>(null);
    const [interactionAnnouncement, setInteractionAnnouncement] = useState('');
    const announcementTimerRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (announcementTimerRef.current) {
                window.clearTimeout(announcementTimerRef.current);
            }
        };
    }, []);

    const announceInteraction = useCallback((message: string): void => {
        if (announcementTimerRef.current) {
            window.clearTimeout(announcementTimerRef.current);
        }

        setInteractionAnnouncement(message);
        announcementTimerRef.current = window.setTimeout(() => {
            setInteractionAnnouncement('');
        }, 1800);
    }, []);

    const resetDragState = useCallback(() => {
        setActiveDragData(null);
        setExternalDropTargetPath(null);
        setActiveExternalRootLaneId(null);
    }, []);

    const extractDroppedEntries = useCallback(async (
        event: DragEvent<HTMLElement>,
        targetFolderPath: string
    ): Promise<FileWithPath[]> => {
        const items = Array.from(event.dataTransfer.items ?? []);

        if (items.length === 0) {
            return Array.from(event.dataTransfer.files ?? []).map((file) => ({
                file,
                path: joinWorkspacePath(targetFolderPath, file.name)
            }));
        }

        const results = await Promise.all(items.map(async (item) => {
            if (item.kind !== 'file') {
                return [] as FileWithPath[];
            }

            const webkitItem = item as WebKitDataTransferItem;
            const entry = webkitItem.webkitGetAsEntry?.();

            if (entry) {
                const processed = await processFileSystemEntry(entry);
                return processed.files;
            }

            const file = item.getAsFile();
            return file
                ? [{ file, path: file.name }]
                : [];
        }));

        return results
            .flat()
            .map((entry) => ({
                file: entry.file,
                path: joinWorkspacePath(targetFolderPath, entry.path)
            }));
    }, []);

    const handleExternalFilesDragOver = useCallback((targetFolderPath: string, event: DragEvent<HTMLElement>): void => {
        if (!hasFileTransfer(event)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy';
        setExternalDropTargetPath(normalizeWorkspaceFolderPath(targetFolderPath));
    }, []);

    const handleExternalFilesDragLeave = useCallback((targetFolderPath: string, event: DragEvent<HTMLElement>): void => {
        if (!hasFileTransfer(event)) {
            return;
        }

        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
            return;
        }

        const normalizedTargetFolderPath = normalizeWorkspaceFolderPath(targetFolderPath);
        setExternalDropTargetPath((currentTargetPath) => {
            return currentTargetPath === normalizedTargetFolderPath
                ? null
                : currentTargetPath;
        });
    }, []);

    const handleExternalFilesDrop = useCallback(async (targetFolderPath: string, event: DragEvent<HTMLElement>): Promise<void> => {
        if (!hasFileTransfer(event)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        setExternalDropTargetPath(null);
        setActiveExternalRootLaneId(null);

        try {
            const entries = await extractDroppedEntries(event, targetFolderPath);
            if (entries.length === 0) {
                return;
            }

            await onUploadEntries(entries);
            const itemLabel = entries.length === 1
                ? entries[0]?.file.name ?? 'file'
                : `${entries.length} files`;

            announceInteraction(`Added ${itemLabel} to ${describeTargetFolder(targetFolderPath)}.`);
        } catch (error) {
            const userError = reportError(error, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to upload dropped files'
            });

            sileo.error({
                title: userError.title,
                description: userError.description
            });
        }
    }, [announceInteraction, extractDroppedEntries, onUploadEntries]);

    const handleExternalRootLaneDragOver = useCallback((laneId: string, event: DragEvent<HTMLElement>): void => {
        setActiveExternalRootLaneId(laneId);
        handleExternalFilesDragOver(ROOT_DROP_DATA.folderPath, event);
    }, [handleExternalFilesDragOver]);

    const handleExternalRootLaneDragLeave = useCallback((laneId: string, event: DragEvent<HTMLElement>): void => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
            setActiveExternalRootLaneId((currentLaneId) => currentLaneId === laneId ? null : currentLaneId);
        }

        handleExternalFilesDragLeave(ROOT_DROP_DATA.folderPath, event);
    }, [handleExternalFilesDragLeave]);

    const handleExternalRootLaneDrop = useCallback(async (laneId: string, event: DragEvent<HTMLElement>): Promise<void> => {
        setActiveExternalRootLaneId((currentLaneId) => currentLaneId === laneId ? null : currentLaneId);
        await handleExternalFilesDrop(ROOT_DROP_DATA.folderPath, event);
    }, [handleExternalFilesDrop]);

    const handleDragStart = useCallback((event: DragStartEvent): void => {
        const dragData = event.active.data.current as LatexWorkspaceDragData | undefined;
        setActiveDragData(dragData ?? null);
    }, []);

    const handleDragEnd = useCallback(async (event: DragEndEvent): Promise<void> => {
        const dragData = event.active.data.current as LatexWorkspaceDragData | undefined;
        const dropData = event.over?.data.current as LatexWorkspaceDropData | undefined;

        resetDragState();

        if (!dragData || !dropData || !canDropLatexWorkspaceItemInFolder(dragData, dropData.folderPath)) {
            return;
        }

        try {
            let didMove = false;

            if (dragData.kind === 'file') {
                didMove = await moveFileToFolder(dragData.id, dropData.folderPath);
            } else if (dragData.kind === 'asset') {
                didMove = await moveAssetToFolder(dragData.id, dropData.folderPath);
            } else {
                didMove = await moveFolderToFolder(dragData.id, dropData.folderPath);
            }

            if (didMove) {
                announceInteraction(`Moved ${dragData.label} to ${dropData.label}.`);
            }
        } catch (error) {
            const userError = reportError(error, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to move workspace item'
            });

            sileo.error({
                title: userError.title,
                description: userError.description
            });
        }
    }, [announceInteraction, moveAssetToFolder, moveFileToFolder, moveFolderToFolder, resetDragState]);

    const rootMenuOptions = useMemo<MenuOption[]>(() => {
        return [
            {
                label: 'New file',
                icon: FilePlus,
                onClick: () => openNewFileIn('')
            },
            {
                label: 'New folder',
                icon: FolderPlus,
                onClick: () => openNewFolderIn('')
            },
            {
                label: 'Upload files',
                icon: Upload,
                onClick: () => fileInputRef.current?.click()
            },
            {
                label: 'Upload folder',
                icon: FolderOpen,
                onClick: () => folderInputRef.current?.click()
            }
        ];
    }, [fileInputRef, folderInputRef, openNewFileIn, openNewFolderIn]);

    const shouldOpenRootContextMenu = useCallback((event: MouseEvent<Element>) => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) {
            return true;
        }

        return target.closest('[role="treeitem"], input, textarea, button, [contenteditable="true"], [contenteditable=""]') === null;
    }, []);

    const newFileAction = (
        <IconButton
            variant='ghost'
            size='sm'
            className='latex-workspace__panel-action'
            title='New file at root'
            aria-label='Create a new file at the project root'
            onClick={() => openNewFileIn('')}
        >
            <FilePlus size={14} />
        </IconButton>
    );

    const newFolderAction = (
        <IconButton
            variant='ghost'
            size='sm'
            className='latex-workspace__panel-action'
            title='New folder at root'
            aria-label='Create a new folder at the project root'
            onClick={() => openNewFolderIn('')}
        >
            <FolderPlus size={14} />
        </IconButton>
    );

    const renderTreeNode = useCallback((node: FileTreeNodeType) => (
        <FileTreeNode
            key={node.id}
            node={node}
            depth={0}
            expandedFolders={expandedFolders}
            selectedAssetId={selectedAssetId}
            newFileTargetFolder={newFileTargetFolder}
            newFolderTargetFolder={newFolderTargetFolder}
            renamingTarget={renamingTarget}
            activeDragData={activeDragData}
            externalDropTargetPath={externalDropTargetPath}
            onToggleFolder={toggleFolder}
            onOpenNewFileIn={openNewFileIn}
            onOpenNewFolderIn={openNewFolderIn}
            onConfirmNewFile={handleConfirmNewFile}
            onCancelNewFile={closeNewFile}
            onConfirmNewFolder={handleConfirmNewFolder}
            onCancelNewFolder={closeNewFolder}
            onFileSelect={onFileSelect}
            onAssetSelect={onAssetSelect}
            onFileDelete={onDeleteFile}
            onFolderDelete={handleDeleteFolder}
            onAssetDelete={onDeleteAsset}
            onAssetInsertRef={(asset) => onInsertRef(buildLatexRef(asset))}
            onStartRenameFile={startRenameFile}
            onStartRenameFolder={startRenameFolder}
            onStartRenameAsset={startRenameAsset}
            onSaveFileName={onRenameFile}
            onSaveFolderName={renameFolder}
            onSaveAssetName={onRenameAsset}
            onCancelRename={cancelRename}
            onFileSetEntrypoint={onSetEntrypoint}
            onExternalFilesDragOver={handleExternalFilesDragOver}
            onExternalFilesDragLeave={handleExternalFilesDragLeave}
            onExternalFilesDrop={handleExternalFilesDrop}
        />
    ), [
        activeDragData,
        cancelRename,
        closeNewFile,
        closeNewFolder,
        expandedFolders,
        externalDropTargetPath,
        handleConfirmNewFile,
        handleConfirmNewFolder,
        handleDeleteFolder,
        handleExternalFilesDragLeave,
        handleExternalFilesDragOver,
        handleExternalFilesDrop,
        newFileTargetFolder,
        newFolderTargetFolder,
        onAssetSelect,
        onDeleteAsset,
        onDeleteFile,
        onFileSelect,
        onInsertRef,
        onRenameAsset,
        onRenameFile,
        onSetEntrypoint,
        openNewFileIn,
        openNewFolderIn,
        renamingTarget,
        renameFolder,
        selectedAssetId,
        startRenameAsset,
        startRenameFile,
        startRenameFolder,
        toggleFolder
    ]);

    const panelActions = (
        <Row gap='05'>
            <Popover
                id='latex-workspace-upload-popover'
                trigger={(
                    <IconButton
                        variant='ghost'
                        size='sm'
                        className='latex-workspace__panel-action'
                        title='Upload'
                        aria-label='Upload files or a folder'
                        disabled={isUploading}
                    >
                        <Upload size={14} />
                    </IconButton>
                )}
                noPadding
                placement='bottom-start'
            >
                {(close) => (
                    <PopoverMenu>
                        <PopoverMenuItem
                            icon={<Upload size={14} />}
                            onClick={() => {
                                close();
                                fileInputRef.current?.click();
                            }}
                        >
                            Files
                        </PopoverMenuItem>
                        <PopoverMenuItem
                            icon={<FolderOpen size={14} />}
                            onClick={() => {
                                close();
                                folderInputRef.current?.click();
                            }}
                        >
                            Folder
                        </PopoverMenuItem>
                    </PopoverMenu>
                )}
            </Popover>
            {newFolderAction}
            {newFileAction}
        </Row>
    );

    const isWorkspaceEmpty = files.length === 0
        && assets.length === 0
        && newFileTargetFolder === null
        && newFolderTargetFolder === null;
    const rootDropPath = normalizeWorkspaceFolderPath(ROOT_DROP_DATA.folderPath);
    const canDropActiveItemInRoot = canDropLatexWorkspaceItemInFolder(activeDragData, ROOT_DROP_DATA.folderPath);
    const shouldShowRootDropLanes = Boolean(
        canDropActiveItemInRoot
        || externalDropTargetPath === rootDropPath
    );
    const shouldShowBottomRootDropLane = shouldShowRootDropLanes && !isWorkspaceEmpty;

    return (
        <Stack id='latex-file-panel' className='latex-workspace__files' style={{ width }}>
            <PanelHeader
                variant='compact'
                icon={<span className='d-flex items-center color-muted'>{FOLDER_ICON}</span>}
                title='Files'
                actions={panelActions}
            />

            <input
                ref={fileInputRef}
                type='file'
                className='d-none'
                multiple
                aria-label='Upload files to the LaTeX workspace'
                onChange={onUploadFiles}
            />

            <input
                ref={folderInputRef}
                type='file'
                className='d-none'
                aria-label='Upload a folder to the LaTeX workspace'
                onChange={onUploadFolders}
                {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
            />

            <span className='latex-workspace__sr-only' aria-live='polite' aria-atomic='true'>
                {interactionAnnouncement}
            </span>

            <FileExplorer>
                <DndContext
                    sensors={sensors}
                    collisionDetection={pointerWithin}
                    onDragStart={handleDragStart}
                    onDragEnd={(event) => {
                        void handleDragEnd(event);
                    }}
                    onDragCancel={resetDragState}
                >
                    <ContextMenuPopover
                        id='latex-workspace-root-context'
                        options={rootMenuOptions}
                        shouldOpenOnContextMenu={shouldOpenRootContextMenu}
                        trigger={(
                            <Stack flex='1' minH='0' className={cn(
                                    'latex-workspace__tree-surface',
                                    isWorkspaceEmpty && 'is-empty'
                                )} onDragOver={(event) => handleExternalFilesDragOver(ROOT_DROP_DATA.folderPath, event)} onDragLeave={(event) => handleExternalFilesDragLeave(ROOT_DROP_DATA.folderPath, event)} onDrop={(event) => {
                                    void handleExternalFilesDrop(ROOT_DROP_DATA.folderPath, event);
                                }}>
                                <RootDropLane
                                    id={`${LATEX_WORKSPACE_ROOT_DROP_ID}:top`}
                                    isVisible={shouldShowRootDropLanes}
                                    isExternallyActive={activeExternalRootLaneId === `${LATEX_WORKSPACE_ROOT_DROP_ID}:top`}
                                    onExternalDragOver={(event) => handleExternalRootLaneDragOver(`${LATEX_WORKSPACE_ROOT_DROP_ID}:top`, event)}
                                    onExternalDragLeave={(event) => handleExternalRootLaneDragLeave(`${LATEX_WORKSPACE_ROOT_DROP_ID}:top`, event)}
                                    onExternalDrop={(event) => handleExternalRootLaneDrop(`${LATEX_WORKSPACE_ROOT_DROP_ID}:top`, event)}
                                />

                                <div role='tree' aria-label='Project files and assets' className='latex-workspace__tree-root'>
                                    {treeNodes.map(renderTreeNode)}
                                    <WorkspaceCreationInputs
                                        folderPath=''
                                        newFileTargetFolder={newFileTargetFolder}
                                        newFolderTargetFolder={newFolderTargetFolder}
                                        folderLabel='Create a folder at the project root'
                                        fileLabel='Create a file at the project root'
                                        fileIcon={<FilePlus size={13} />}
                                        onConfirmNewFolder={handleConfirmNewFolder}
                                        onCancelNewFolder={closeNewFolder}
                                        onConfirmNewFile={handleConfirmNewFile}
                                        onCancelNewFile={closeNewFile}
                                    />
                                </div>

                                <RootDropLane
                                    id={`${LATEX_WORKSPACE_ROOT_DROP_ID}:bottom`}
                                    isVisible={shouldShowBottomRootDropLane}
                                    fillAvailableSpace
                                    isExternallyActive={activeExternalRootLaneId === `${LATEX_WORKSPACE_ROOT_DROP_ID}:bottom`}
                                    onExternalDragOver={(event) => handleExternalRootLaneDragOver(`${LATEX_WORKSPACE_ROOT_DROP_ID}:bottom`, event)}
                                    onExternalDragLeave={(event) => handleExternalRootLaneDragLeave(`${LATEX_WORKSPACE_ROOT_DROP_ID}:bottom`, event)}
                                    onExternalDrop={(event) => handleExternalRootLaneDrop(`${LATEX_WORKSPACE_ROOT_DROP_ID}:bottom`, event)}
                                />

                                {isWorkspaceEmpty && (
                                    <Stack align='center' justify='center' gap='05' className='latex-workspace__tree-empty-state'>
                                        <Text as='p' tone='primary'>No files yet</Text>
                                        <Text as='p' tone='muted' className='latex-workspace__tree-empty-copy'>
                                            Drag files here, create a file, or right-click for project actions.
                                        </Text>
                                    </Stack>
                                )}
                            </Stack>
                        )}
                    />
                </DndContext>
            </FileExplorer>
        </Stack>
    );
};

export default memo(LatexFilePanel);
