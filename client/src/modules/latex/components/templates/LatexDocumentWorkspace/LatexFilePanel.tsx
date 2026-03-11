import useLatexAssets from '@/modules/latex/hooks/use-latex-assets';
import useFileTree from '@/modules/latex/hooks/use-file-tree';
import Container from '@/shared/presentation/components/Container';
import FileExplorer from '@/shared/presentation/components/FileExplorer';
import IconButton from '@/shared/presentation/components/IconButton';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import FileTreeNode from './FileTreeNode';
import NewFileInput from './NewFileInput';
import NewFolderInput from './NewFolderInput';
import RootDropZone from './RootDropZone';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { FilePlus, FolderOpen, FolderPlus, Upload } from 'lucide-react';
import type { LatexFileEntry } from '@/modules/latex/hooks/use-latex-workspace';
import type { FileTreeNode as FileTreeNodeType } from '@/modules/latex/utilities/file-tree';

interface LatexFilePanelProps {
    documentId: string;
    files: LatexFileEntry[];
    onInsertRef: (ref: string) => void;
    onFileSelect: (fileId: string) => void;
    onCreateFile: (name: string, path?: string) => Promise<unknown>;
    onDeleteFile: (fileId: string) => void;
    onSetEntrypoint: (fileId: string) => void;
    onMoveFile: (fileId: string, newPath: string) => Promise<void>;
    width: number;
};

const FOLDER_ICON = <FolderOpen size={14} />;

const LatexFilePanel = ({
    documentId,
    files,
    onInsertRef,
    onFileSelect,
    onCreateFile,
    onDeleteFile,
    onSetEntrypoint,
    onMoveFile,
    width
}: LatexFilePanelProps) => {
    const {
        assets,
        isUploading,
        fileInputRef,
        handleUploadClick,
        handleFileSelected,
        handleDeleteAsset,
        handleInsertRef,
        handleMoveAsset
    } = useLatexAssets({ documentId, onInsertRef });

    const {
        treeNodes,
        expandedFolders,
        newFileTargetFolder,
        newFolderTargetFolder,
        toggleFolder,
        openNewFileIn,
        closeNewFile,
        handleConfirmNewFile,
        openNewFolderIn,
        closeNewFolder,
        handleConfirmNewFolder,
        handleDragEnd
    } = useFileTree({
        files,
        assets,
        onMoveFile,
        onMoveAsset: handleMoveAsset,
        onCreateFile
    });

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 }
        })
    );

    const folderIcon = <span className='d-flex items-center color-muted'>{FOLDER_ICON}</span>;

    const newFileAction = (
        <IconButton
            variant='ghost'
            size='sm'
            title='New .tex file at root'
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

    const uploadAction = (
        <IconButton
            variant='ghost'
            size='sm'
            title='Upload assets'
            disabled={isUploading}
            onClick={handleUploadClick}
        >
            <Upload size={14} />
        </IconButton>
    );

    const newFileInputSlot = (
        <NewFileInput
            onConfirm={handleConfirmNewFile}
            onCancel={closeNewFile}
        />
    );

    const newFolderInputSlot = (
        <NewFolderInput
            onConfirm={handleConfirmNewFolder}
            onCancel={closeNewFolder}
        />
    );

    const renderTreeNode = (node: FileTreeNodeType) => (
        <FileTreeNode
            key={node.id}
            node={node}
            depth={0}
            expandedFolders={expandedFolders}
            newFileTargetFolder={newFileTargetFolder}
            newFolderTargetFolder={newFolderTargetFolder}
            onToggleFolder={toggleFolder}
            onOpenNewFileIn={openNewFileIn}
            onOpenNewFolderIn={openNewFolderIn}
            newFileInputSlot={newFileInputSlot}
            newFolderInputSlot={newFolderInputSlot}
            onFileSelect={onFileSelect}
            onFileDelete={onDeleteFile}
            onFileSetEntrypoint={onSetEntrypoint}
            onAssetDelete={handleDeleteAsset}
            onAssetInsertRef={handleInsertRef}
        />
    );

    const panelActions = (
        <Container className='d-flex items-center gap-025'>
            {newFolderAction}
            {newFileAction}
            {uploadAction}
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
                icon={folderIcon}
                title='Files'
                actions={panelActions}
            />

            <input
                ref={fileInputRef}
                type='file'
                className='d-none'
                multiple
                onChange={handleFileSelected}
                accept='image/*,.pdf,.bib,.cls,.sty'
            />

            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <FileExplorer isEmpty={isEmpty} emptyMessage='No files'>
                    <RootDropZone>
                        {treeNodes.map(renderTreeNode)}
                        {newFolderTargetFolder === '' && (
                            <NewFolderInput
                                onConfirm={handleConfirmNewFolder}
                                onCancel={closeNewFolder}
                            />
                        )}
                        {newFileTargetFolder === '' && (
                            <NewFileInput
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

export default LatexFilePanel;
