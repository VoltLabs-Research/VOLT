import { Button } from '@heroui/react';
import { openModal } from '@/shared/ui/modal/use-modal-store';
import { Folder, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import type { MenuOption } from '@/shared/contracts/menu';

interface NewFolderHeaderActionProps {
    modalId: string;
};

interface FolderHeaderMenuOptionsParams<TFolder> {
    currentFolder: TFolder | null;
    onRenameFolderOpen: (folder: TFolder) => void;
    onDeleteCurrentFolder: (() => void | Promise<void>) | null;
    newFolderModalId?: string;
    extraOptions?: MenuOption[];
};

export const NewFolderHeaderAction = ({ modalId }: NewFolderHeaderActionProps) => (
    <Button
        variant='ghost'
        size='sm'
        onPress={() => openModal(modalId)}
    >
        <Folder size={14} />
        New Folder
    </Button>
);

export const getFolderHeaderMenuOptions = <TFolder,>({
    currentFolder,
    onRenameFolderOpen,
    onDeleteCurrentFolder,
    newFolderModalId,
    extraOptions = []
}: FolderHeaderMenuOptionsParams<TFolder>): MenuOption[] => {
    const options: MenuOption[] = [];

    if (newFolderModalId) {
        options.push({
            label: 'New Folder',
            icon: FolderPlus,
            onClick: () => openModal(newFolderModalId)
        });
    }

    if (currentFolder) {
        options.push(
            {
                label: 'Rename Folder',
                icon: Pencil,
                onClick: () => onRenameFolderOpen(currentFolder)
            },
            {
                label: 'Delete Folder',
                icon: Trash2,
                onClick: () => onDeleteCurrentFolder?.(),
                destructive: true,
                disabled: !onDeleteCurrentFolder
            }
        );
    }

    return [...options, ...extraOptions];
};
