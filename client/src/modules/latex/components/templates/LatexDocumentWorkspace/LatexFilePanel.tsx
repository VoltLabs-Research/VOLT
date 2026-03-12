import { memo } from 'react';
import useFileTree from '@/modules/latex/hooks/use-file-tree';
import { buildLatexRef } from '@/modules/latex/hooks/use-latex-assets';
import Container from '@/shared/presentation/components/Container';
import FileExplorer from '@/shared/presentation/components/FileExplorer';
import IconButton from '@/shared/presentation/components/IconButton';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import FileTreeNode from './FileTreeNode';
import WorkspaceEntryInput from './WorkspaceEntryInput';
import RootDropZone from './RootDropZone';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { FilePlus, FolderOpen, FolderPlus, Upload } from 'lucide-react';
import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';
import type { LatexFileEntry } from '@/modules/latex/hooks/use-latex-workspace';
import type { FileTreeNode as FileTreeNodeType } from '@/modules/latex/utilities/file-tree';
import type { ChangeEvent, RefObject } from 'react';

interface LatexFilePanelProps {
    documentId: string;
    files: LatexFileEntry[];
    assets: LatexAsset[];
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
    onMoveFile: (fileId: string, newPath: string) => Promise<void>;
    onMoveAsset: (assetId: string, newPath: string) => Promise<void>;
    onRenameFile: (fileId: string, name: string) => Promise<void>;
    onRenameAsset: (asset: LatexAsset, name: string) => Promise<void>;
    onInsertRef: (ref: string) => void;
    onUploadFiles: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
    onUploadFolders: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
};

const FOLDER_ICON = <FolderOpen size={14} />;

const LatexFilePanel = ({
    documentId,
    files,
    assets,
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
    onMoveFile,
    onMoveAsset,
    onRenameFile,
    onRenameAsset,
    onInsertRef,
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
        cancelRename,
        handleConfirmRename,
        handleDeleteFolder,
        handleDragEnd
    } = useFileTree({
        files,
        assets,
        onMoveFile,
        onMoveAsset,
        onCreateFile,
        onCreateFolder,
        onRenameFile,
        onRenameAsset,
        onDeleteFileDirect,
        onDeleteAssetDirect,
        onUpdateFileDirect,
        onUpdateAssetDirect,
        documentId
    });

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 }
        })
    );

    const newFileAction = (
        <IconButton
            variant='ghost'
            size='sm'
            title='New file at root'
            onClick={() => openNewFileIn('')}
        >
            <FilePlus size={14} />
        </IconButton>
    );

    const newFolderAction = (
        <IconButton
            variant='ghost'
            size='sm'
            title='New folder at root'
            onClick={() => openNewFolderIn('')}
        >
            <FolderPlus size={14} />
        </IconButton>
    );

    const renderTreeNode = (node: FileTreeNodeType) => (
        <FileTreeNode
            key={node.id}
            node={node}
            depth={0}
            expandedFolders={expandedFolders}
            newFileTargetFolder={newFileTargetFolder}
            newFolderTargetFolder={newFolderTargetFolder}
            renamingTarget={renamingTarget}
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
            onRenameFile={startRenameFile}
            onRenameFolder={startRenameFolder}
            onRenameAsset={startRenameAsset}
            onConfirmRename={handleConfirmRename}
            onCancelRename={cancelRename}
        />
    );

    const panelActions = (
        <Container className='d-flex items-center gap-025'>
            <Popover
                id='latex-workspace-upload-popover'
                trigger={(
                    <IconButton
                        variant='ghost'
                        size='sm'
                        title='Upload'
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
        </Container>
    );

    const isEmpty = files.length === 0
        && assets.length === 0
        && newFileTargetFolder === null
        && newFolderTargetFolder === null;

    return (
        <Container className='latex-workspace__files d-flex column' style={{ width }}>
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
                onChange={onUploadFiles}
            />

            <input
                ref={folderInputRef}
                type='file'
                className='d-none'
                onChange={onUploadFolders}
                {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
            />

            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <FileExplorer isEmpty={isEmpty} emptyMessage='No files'>
                    <RootDropZone>
                        {treeNodes.map(renderTreeNode)}
                        {newFolderTargetFolder === '' && (
                            <WorkspaceEntryInput
                                icon={<FolderPlus size={13} />}
                                placeholder='Folder name'
                                onConfirm={handleConfirmNewFolder}
                                onCancel={closeNewFolder}
                            />
                        )}
                        {newFileTargetFolder === '' && (
                            <WorkspaceEntryInput
                                icon={<FilePlus size={13} />}
                                placeholder='File name'
                                onConfirm={handleConfirmNewFile}
                                onCancel={closeNewFile}
                            />
                        )}
                    </RootDropZone>
                </FileExplorer>
            </DndContext>
        </Container>
    );
};

export default memo(LatexFilePanel);
