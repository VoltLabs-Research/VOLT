import WorkspaceEntryInput from './WorkspaceEntryInput';
import { FolderPlus } from 'lucide-react';
import type { ReactNode } from 'react';

interface WorkspaceCreationInputsProps {
    folderPath: string;
    newFileTargetFolder: string | null;
    newFolderTargetFolder: string | null;
    folderLabel: string;
    fileLabel: string;
    fileIcon: ReactNode;
    onConfirmNewFolder: (name: string) => Promise<void>;
    onCancelNewFolder: () => void;
    onConfirmNewFile: (name: string) => Promise<void>;
    onCancelNewFile: () => void;
}

const WorkspaceCreationInputs = ({
    folderPath,
    newFileTargetFolder,
    newFolderTargetFolder,
    folderLabel,
    fileLabel,
    fileIcon,
    onConfirmNewFolder,
    onCancelNewFolder,
    onConfirmNewFile,
    onCancelNewFile
}: WorkspaceCreationInputsProps) => {
    return (
        <>
            {newFolderTargetFolder === folderPath && (
                <WorkspaceEntryInput
                    icon={<FolderPlus size={13} />}
                    label={folderLabel}
                    placeholder='Folder name'
                    onConfirm={onConfirmNewFolder}
                    onCancel={onCancelNewFolder}
                />
            )}
            {newFileTargetFolder === folderPath && (
                <WorkspaceEntryInput
                    icon={fileIcon}
                    label={fileLabel}
                    placeholder='File name'
                    onConfirm={onConfirmNewFile}
                    onCancel={onCancelNewFile}
                />
            )}
        </>
    );
};

export default WorkspaceCreationInputs;
