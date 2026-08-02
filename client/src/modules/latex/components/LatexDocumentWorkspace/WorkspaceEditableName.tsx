import EditableTag from '@/shared/ui/components/EditableTag';
import { useWorkspaceTree } from './workspace-tree-context';

interface WorkspaceEditableNameProps {
    children: string;
    isRenaming: boolean;
    onSave: (nextName: string) => void;
}

/**
 * Tree row label that turns into an inline rename field, either on
 * double-click or when the row is the current rename target.
*/
const WorkspaceEditableName = ({ children, isRenaming, onSave }: WorkspaceEditableNameProps) => {
    const { cancelRename } = useWorkspaceTree();

    return (
        <EditableTag
            as='span'
            className='latex-workspace__file-name text-truncate'
            title='Double-click to rename'
            allowSingleClickPropagation
            editing={isRenaming ? true : undefined}
            onEditingChange={(nextEditing) => {
                if (!nextEditing && isRenaming) {
                    cancelRename();
                }
            }}
            onSave={onSave}
        >
            {children}
        </EditableTag>
    );
};

export default WorkspaceEditableName;
