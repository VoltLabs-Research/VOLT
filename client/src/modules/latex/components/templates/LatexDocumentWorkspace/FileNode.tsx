import Container from '@/shared/presentation/components/Container';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import { cn } from '@/shared/utils';
import { FileText, Star, Trash2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import type { FileTreeNode as FileTreeNodeType } from '@/modules/latex/utilities/file-tree';
import type { LatexFileEntry } from '@/modules/latex/hooks/use-latex-workspace';
import type { MenuOption } from '@/shared/presentation/types/menu';

interface FileNodeProps {
    node: FileTreeNodeType;
    depth: number;
    onFileSelect: (fileId: string) => void;
    onFileDelete: (fileId: string) => void;
    onFileSetEntrypoint: (fileId: string) => void;
};

/** Renders a file row inside the file tree with a right-click context menu. */
const FileNode = ({ node, depth, onFileSelect, onFileDelete, onFileSetEntrypoint }: FileNodeProps) => {
    const file = node.data as LatexFileEntry;
    const indent = depth * 12;

    const handleSelect = useCallback(
        () => onFileSelect(file._id),
        [file._id, onFileSelect]
    );

    const handleDelete = useCallback(
        () => onFileDelete(file._id),
        [file._id, onFileDelete]
    );

    const handleEntrypoint = useCallback(
        () => onFileSetEntrypoint(file._id),
        [file._id, onFileSetEntrypoint]
    );

    const menuOptions = useMemo((): MenuOption[] => {
        const options: MenuOption[] = [];
        if (!file.isEntrypoint) {
            options.push({
                label: 'Set as entrypoint',
                icon: Star,
                onClick: handleEntrypoint
            });
        }
        options.push({
            label: 'Delete',
            icon: Trash2,
            onClick: handleDelete,
            destructive: true
        });
        return options;
    }, [file.isEntrypoint, handleEntrypoint, handleDelete]);

    const content = (
        <Container
            className={cn(
                'latex-workspace__file-row d-flex items-center gap-05',
                file.isSelected && 'is-selected'
            )}
            style={{ paddingLeft: `${0.75 + indent / 16}rem` }}
            onClick={handleSelect}
        >
            <span className='color-muted d-flex items-center f-shrink-0'>
                <FileText size={13} />
            </span>
            <span className='latex-workspace__file-name text-truncate'>{file.name}</span>
            {file.isEntrypoint && (
                <span
                    className='latex-workspace__entrypoint-badge color-muted f-shrink-0'
                    title='Entrypoint'
                >
                    <Star size={10} />
                </span>
            )}
        </Container>
    );

    return (
        <ContextMenuPopover
            id={`file-ctx-${file._id}`}
            trigger={content}
            options={menuOptions}
            size='sm'
        />
    );
};

export default FileNode;
