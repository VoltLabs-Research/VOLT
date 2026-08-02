import { memo } from 'react';
import useFileTree from '@/modules/latex/hooks/use-file-tree';
import useLatexWorkspaceDnd from './use-latex-workspace-dnd';
import { canDropLatexWorkspaceItemInFolder } from '@/modules/latex/utils/workspace-dnd';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import FileExplorer from '@/shared/ui/components/FileExplorer';
import PanelHeader from '@/shared/ui/components/PanelHeader';
import { Popover, PopoverMenu, PopoverMenuItem, IconButton, Row, Stack, Text } from '@voltstack/bravais';
import FileTreeNode from './FileTreeNode';
import WorkspaceCreationInputs from './WorkspaceCreationInputs';
import WorkspaceRootDropLane, { ROOT_DROP_PATH } from './WorkspaceRootDropLane';
import { WorkspaceTreeProvider } from './workspace-tree-context';
import { DndContext, pointerWithin } from '@dnd-kit/core';
import { cn } from '@/shared/utils/cn';
import { FilePlus, FolderOpen, FolderPlus, Upload } from 'lucide-react';
import type { LatexAsset } from '@volt/contracts/modules/latex/domain';
import type { FileWithPath } from '@/shared/utils/file';
import type { MenuOption } from '@/shared/contracts/menu';
import type { ChangeEvent, MouseEvent, RefObject } from 'react';

interface LatexFilePanelProps extends Omit<Parameters<typeof useFileTree>[0], 'folderPaths'> {
    selectedAssetId: string | null;
    width: number;
    fileInputRef: RefObject<HTMLInputElement | null>;
    folderInputRef: RefObject<HTMLInputElement | null>;
    isUploading: boolean;
    onFileSelect: (fileId: string) => void;
    onAssetSelect: (assetId: string) => void;
    onDeleteFile: (fileId: string) => Promise<void>;
    onDeleteAsset: (asset: LatexAsset) => Promise<void>;
    onRenameFile: (fileId: string, name: string) => Promise<void>;
    onRenameAsset: (asset: LatexAsset, name: string) => Promise<void>;
    onSetEntrypoint: (fileId: string) => Promise<void>;
    onInsertRef: (ref: string) => void;
    onUploadEntries: (entries: FileWithPath[]) => Promise<void>;
    onUploadFiles: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
    onUploadFolders: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

const LatexFilePanel = (props: LatexFilePanelProps) => {
    const {
        files,
        assets,
        width,
        fileInputRef,
        folderInputRef,
        isUploading,
        onUploadFiles,
        onUploadFolders
    } = props;
    const tree = useFileTree(props);
    const dnd = useLatexWorkspaceDnd({
        ...tree,
        onUploadEntries: props.onUploadEntries
    });

    const rootMenuOptions: MenuOption[] = [
        {
            label: 'New file',
            icon: FilePlus,
            onClick: () => tree.openNewFileIn(ROOT_DROP_PATH)
        },
        {
            label: 'New folder',
            icon: FolderPlus,
            onClick: () => tree.openNewFolderIn(ROOT_DROP_PATH)
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

    const shouldOpenRootContextMenu = (event: MouseEvent<Element>): boolean => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) {
            return true;
        }

        return target.closest('[role="treeitem"], input, textarea, button, [contenteditable="true"], [contenteditable=""]') === null;
    };

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
            <IconButton
                variant='ghost'
                size='sm'
                className='latex-workspace__panel-action'
                title='New folder at root'
                aria-label='Create a new folder at the project root'
                onClick={() => tree.openNewFolderIn(ROOT_DROP_PATH)}
            >
                <FolderPlus size={14} />
            </IconButton>
            <IconButton
                variant='ghost'
                size='sm'
                className='latex-workspace__panel-action'
                title='New file at root'
                aria-label='Create a new file at the project root'
                onClick={() => tree.openNewFileIn(ROOT_DROP_PATH)}
            >
                <FilePlus size={14} />
            </IconButton>
        </Row>
    );

    const isWorkspaceEmpty = files.length === 0
        && assets.length === 0
        && tree.newFileTargetFolder === null
        && tree.newFolderTargetFolder === null;
    const shouldShowRootDropLanes = canDropLatexWorkspaceItemInFolder(dnd.activeDragData, ROOT_DROP_PATH)
        || dnd.externalDropTargetPath === ROOT_DROP_PATH;

    return (
        <Stack id='latex-file-panel' className='latex-workspace__files' style={{ width }}>
            <PanelHeader
                variant='compact'
                icon={<Row as='span' className='color-muted'><FolderOpen size={14} /></Row>}
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
                {...({
                    webkitdirectory: '',
                    directory: ''
                } as Record<string, string>)}
            />

            <span className='latex-workspace__sr-only' aria-live='polite' aria-atomic='true'>
                {dnd.interactionAnnouncement}
            </span>

            <FileExplorer>
                <DndContext
                    sensors={dnd.sensors}
                    collisionDetection={pointerWithin}
                    onDragStart={dnd.handleDragStart}
                    onDragEnd={(event) => {
                        void dnd.handleDragEnd(event);
                    }}
                    onDragCancel={dnd.resetDragState}
                >
                    <WorkspaceTreeProvider value={{
                        ...tree,
                        ...dnd,
                        ...props
                    }}>
                        <ContextMenuPopover
                            id='latex-workspace-root-context'
                            options={rootMenuOptions}
                            shouldOpenOnContextMenu={shouldOpenRootContextMenu}
                            trigger={(
                                <Stack flex='1' minH='0' className={cn(
                                        'latex-workspace__tree-surface',
                                        isWorkspaceEmpty && 'is-empty'
                                    )} onDragOver={(event) => dnd.handleExternalFilesDragOver(ROOT_DROP_PATH, event)} onDragLeave={(event) => dnd.handleExternalFilesDragLeave(ROOT_DROP_PATH, event)} onDrop={(event) => {
                                        void dnd.handleExternalFilesDrop(ROOT_DROP_PATH, event);
                                    }}>
                                    <WorkspaceRootDropLane position='top' isVisible={shouldShowRootDropLanes} />

                                    <div role='tree' aria-label='Project files and assets' className='latex-workspace__tree-root'>
                                        {tree.treeNodes.map((node) => (
                                            <FileTreeNode key={node.id} node={node} depth={0} />
                                        ))}
                                        <WorkspaceCreationInputs
                                            folderPath={ROOT_DROP_PATH}
                                            parentLabel='at the project root'
                                            fileIcon={<FilePlus size={13} />}
                                        />
                                    </div>

                                    <WorkspaceRootDropLane position='bottom' isVisible={shouldShowRootDropLanes && !isWorkspaceEmpty} />

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
                    </WorkspaceTreeProvider>
                </DndContext>
            </FileExplorer>
        </Stack>
    );
};

export default memo(LatexFilePanel);
