import WorkspaceDraggableRow from './WorkspaceDraggableRow';
import { createDeleteMenuOption, createRenameMenuOption } from './workspace-row-menus';
import { useWorkspaceTree } from './workspace-tree-context';
import { buildLatexRef } from '@/modules/latex/hooks/use-latex-assets';
import { isWorkspaceImageFile, isWorkspacePdfFile, isWorkspaceTextLikeFile } from '@/modules/latex/utils/workspace';
import { File, FileCode, FileText, Image, Link } from 'lucide-react';
import type { LatexAsset } from '@volt/contracts/modules/latex/domain';
import type { FileTreeAssetNode } from '@/modules/latex/utils/file-tree';
import type { MenuOption } from '@/shared/contracts/menu';

interface WorkspaceAssetRowProps {
    node: FileTreeAssetNode;
    depth: number;
}

const getAssetIcon = (asset: LatexAsset) => {
    if (isWorkspacePdfFile(asset.path, asset.mimetype)) {
        return <FileText size={13} />;
    }

    if (isWorkspaceImageFile(asset.path, asset.mimetype)) {
        return <Image size={13} />;
    }

    if (isWorkspaceTextLikeFile(asset.path, asset.mimetype)) {
        return <FileCode size={13} />;
    }

    return <File size={13} />;
};

const WorkspaceAssetRow = ({ node, depth }: WorkspaceAssetRowProps) => {
    const {
        renamingTarget,
        selectedAssetId,
        onAssetSelect,
        onDeleteAsset,
        onInsertRef,
        onRenameAsset,
        startRenameAsset
    } = useWorkspaceTree();
    const asset = node.data;
    const isRenaming = renamingTarget?.id === `asset:${asset._id}`;
    const menuOptions: MenuOption[] = [
        {
            label: 'Insert reference',
            icon: Link,
            onClick: () => onInsertRef(buildLatexRef(asset))
        },
        createRenameMenuOption(() => startRenameAsset(asset)),
        createDeleteMenuOption(() => onDeleteAsset(asset))
    ];

    return (
        <WorkspaceDraggableRow
            contextMenuId={`asset-ctx-${asset._id}`}
            nodeId={node.id}
            depth={depth}
            icon={getAssetIcon(asset)}
            name={node.name}
            selected={selectedAssetId === asset._id}
            treeItemLabel={`Asset ${node.name}`}
            title={asset.path}
            dragData={{
                kind: 'asset',
                id: asset._id,
                label: node.name,
                folderPath: node.folderPath
            }}
            isRenaming={isRenaming}
            menuOptions={menuOptions}
            onSelect={() => onAssetSelect(asset._id)}
            onRename={(nextName) => {
                void onRenameAsset(asset, nextName);
            }}
        />
    );
};

export default WorkspaceAssetRow;
