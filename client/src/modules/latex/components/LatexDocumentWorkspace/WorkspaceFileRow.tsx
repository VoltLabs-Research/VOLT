import WorkspaceDraggableRow from './WorkspaceDraggableRow';
import { createDeleteMenuOption, createRenameMenuOption } from './workspace-row-menus';
import { useWorkspaceTree } from './workspace-tree-context';
import { FileCode, Star } from 'lucide-react';
import type { FileTreeFileNode } from '@/modules/latex/utils/file-tree';
import type { MenuOption } from '@/shared/contracts/menu';

interface WorkspaceFileRowProps {
    node: FileTreeFileNode;
    depth: number;
}

const WorkspaceFileRow = ({ node, depth }: WorkspaceFileRowProps) => {
    const {
        renamingTarget,
        onFileSelect,
        onDeleteFile,
        onRenameFile,
        onSetEntrypoint,
        startRenameFile
    } = useWorkspaceTree();
    const file = node.data;
    const isRenaming = renamingTarget?.id === `file:${file._id}`;
    const menuOptions: MenuOption[] = [
        ...(file.name.toLowerCase().endsWith('.tex') ? [{
            label: 'Set as entrypoint',
            icon: Star,
            onClick: () => onSetEntrypoint(file._id),
            disabled: file.isEntrypoint
        }] : []),
        createRenameMenuOption(() => startRenameFile(file)),
        createDeleteMenuOption(() => onDeleteFile(file._id))
    ];

    return (
        <WorkspaceDraggableRow
            contextMenuId={`file-ctx-${file._id}`}
            nodeId={node.id}
            depth={depth}
            icon={<FileCode size={13} />}
            name={file.name}
            selected={file.isSelected}
            treeItemLabel={`File ${file.name}`}
            title={file.path}
            dragData={{
                kind: 'file',
                id: file._id,
                label: file.name,
                folderPath: file.path
            }}
            isRenaming={isRenaming}
            menuOptions={menuOptions}
            onSelect={() => onFileSelect(file._id)}
            onRename={(nextName) => {
                void onRenameFile(file._id, nextName);
            }}
        />
    );
};

export default WorkspaceFileRow;
