import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import { ChevronDown, ChevronRight, FolderOpen, Folder, FolderPlus, Plus } from 'lucide-react';
import { useCallback } from 'react';
import type { FileTreeNode as FileTreeNodeType } from '@/modules/latex/utilities/file-tree';

interface FolderNodeProps {
    node: FileTreeNodeType;
    depth: number;
    expandedFolders: Set<string>;
    newFileTargetFolder: string | null;
    newFolderTargetFolder: string | null;
    onToggleFolder: (folderPath: string) => void;
    onOpenNewFileIn: (folderPath: string) => void;
    onOpenNewFolderIn: (folderPath: string) => void;
    newFileInputSlot?: React.ReactNode;
    newFolderInputSlot?: React.ReactNode;
    renderChild: (child: FileTreeNodeType) => React.ReactNode;
};

/** Renders a folder row and, when expanded, its children via the `renderChild` render-prop. */
const FolderNode = ({
    node,
    depth,
    expandedFolders,
    newFileTargetFolder,
    newFolderTargetFolder,
    onToggleFolder,
    onOpenNewFileIn,
    onOpenNewFolderIn,
    newFileInputSlot,
    newFolderInputSlot,
    renderChild
}: FolderNodeProps) => {
    const indent = depth * 12;
    const isExpanded = expandedFolders.has(node.folderPath);
    const showNewFileInput = newFileTargetFolder === node.folderPath;
    const showNewFolderInput = newFolderTargetFolder === node.folderPath;

    const handleToggle = useCallback(
        () => onToggleFolder(node.folderPath),
        [node.folderPath, onToggleFolder]
    );

    const handleNewFile = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onOpenNewFileIn(node.folderPath);
        },
        [node.folderPath, onOpenNewFileIn]
    );

    const handleNewFolder = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onOpenNewFolderIn(node.folderPath);
        },
        [node.folderPath, onOpenNewFolderIn]
    );

    const chevron = isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />;
    const folderIcon = isExpanded ? <FolderOpen size={13} /> : <Folder size={13} />;

    return (
        <>
            <Container
                className='latex-tree__folder-row d-flex items-center content-between gap-05'
                style={{ paddingLeft: `${0.5 + indent / 16}rem` }}
                onClick={handleToggle}
            >
                <Container className='d-flex items-center gap-025 flex-1 min-w-0'>
                    <span className='color-muted d-flex items-center f-shrink-0'>{chevron}</span>
                    <span className='color-muted d-flex items-center f-shrink-0'>{folderIcon}</span>
                    <span className='latex-tree__name text-truncate'>{node.name}</span>
                </Container>
                <Container className='d-flex items-center gap-025'>
                    <IconButton
                        variant='ghost'
                        size='sm'
                        title='New subfolder'
                        onClick={handleNewFolder}
                    >
                        <FolderPlus size={12} />
                    </IconButton>
                    <IconButton
                        variant='ghost'
                        size='sm'
                        title='New file in this folder'
                        onClick={handleNewFile}
                    >
                        <Plus size={12} />
                    </IconButton>
                </Container>
            </Container>

            {isExpanded && (
                <Container className='d-flex column'>
                    {node.children.map(renderChild)}
                    {showNewFolderInput && newFolderInputSlot}
                    {showNewFileInput && newFileInputSlot}
                </Container>
            )}
        </>
    );
};

export default FolderNode;
