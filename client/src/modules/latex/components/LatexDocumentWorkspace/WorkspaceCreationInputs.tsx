import WorkspaceEntryInput from './WorkspaceEntryInput';
import { useWorkspaceTree } from './workspace-tree-context';
import { FolderPlus } from 'lucide-react';
import type { ReactNode } from 'react';

interface WorkspaceCreationInputsProps {
    folderPath: string;
    /** Where the entry is being created, e.g. `at the project root`. */
    parentLabel: string;
    fileIcon: ReactNode;
}

const WorkspaceCreationInputs = ({ folderPath, parentLabel, fileIcon }: WorkspaceCreationInputsProps) => {
    const {
        newFileTargetFolder,
        newFolderTargetFolder,
        handleConfirmNewFile,
        handleConfirmNewFolder,
        closeNewFile,
        closeNewFolder
    } = useWorkspaceTree();

    return (
        <>
            {newFolderTargetFolder === folderPath && (
                <WorkspaceEntryInput
                    icon={<FolderPlus size={13} />}
                    label={`Create a folder ${parentLabel}`}
                    placeholder='Folder name'
                    onConfirm={handleConfirmNewFolder}
                    onCancel={closeNewFolder}
                />
            )}
            {newFileTargetFolder === folderPath && (
                <WorkspaceEntryInput
                    icon={fileIcon}
                    label={`Create a file ${parentLabel}`}
                    placeholder='File name'
                    onConfirm={handleConfirmNewFile}
                    onCancel={closeNewFile}
                />
            )}
        </>
    );
};

export default WorkspaceCreationInputs;
