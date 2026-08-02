import { Pencil, Trash2 } from 'lucide-react';
import type { MenuOption } from '@/shared/contracts/menu';

export const createRenameMenuOption = (onClick: () => void | Promise<void>): MenuOption => ({
    label: 'Rename',
    icon: Pencil,
    onClick
});

export const createDeleteMenuOption = (onClick: () => void | Promise<void>): MenuOption => ({
    label: 'Delete',
    icon: Trash2,
    onClick,
    destructive: true
});
