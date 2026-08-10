import { Button } from '@heroui/react';
import { openModal } from '@/shared/ui/modal';
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

/**
 * `title='Create folder'` is dropped: HeroUI's `Button` prop interface is closed
 * (React Aria's `ButtonProps` plus `GlobalDOMAttributes`, which does not carry
 * `title`), so the native tooltip has no route through it. The button keeps its
 * visible "New Folder" label, which was already its accessible name — the tooltip
 * was a second, differently-worded copy of it.
 *
 * `shape='rounded'` was bravais's default and is dropped with it; HeroUI's button
 * radius is the design system's, not a per-call-site choice.
 */
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
