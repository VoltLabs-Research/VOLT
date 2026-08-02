import { createContext, useContext } from 'react';
import type useFileTree from '@/modules/latex/hooks/use-file-tree';
import type useLatexWorkspaceDnd from './use-latex-workspace-dnd';
import type { LatexAsset } from '@volt/contracts/modules/latex/domain';

type FileTreeState = ReturnType<typeof useFileTree>;

type TreeDragState = Pick<ReturnType<typeof useLatexWorkspaceDnd>,
    | 'activeDragData'
    | 'externalDropTargetPath'
    | 'handleExternalFilesDragOver'
    | 'handleExternalFilesDragLeave'
    | 'handleExternalFilesDrop'
>;

export interface WorkspaceTreeContextValue extends FileTreeState, TreeDragState {
    selectedAssetId: string | null;
    onFileSelect: (fileId: string) => void;
    onAssetSelect: (assetId: string) => void;
    onDeleteFile: (fileId: string) => Promise<void>;
    onDeleteAsset: (asset: LatexAsset) => Promise<void>;
    onRenameFile: (fileId: string, name: string) => Promise<void>;
    onRenameAsset: (asset: LatexAsset, name: string) => Promise<void>;
    onSetEntrypoint: (fileId: string) => Promise<void>;
    onInsertRef: (ref: string) => void;
}

/**
 * Ambient state every workspace tree row needs. Rows are rendered recursively
 * at an unbounded depth, so the alternative is forwarding the same ~25 values
 * through every level unchanged.
*/
const WorkspaceTreeContext = createContext<WorkspaceTreeContextValue | null>(null);

export const WorkspaceTreeProvider = WorkspaceTreeContext.Provider;

export const useWorkspaceTree = (): WorkspaceTreeContextValue => useContext(WorkspaceTreeContext)!;
