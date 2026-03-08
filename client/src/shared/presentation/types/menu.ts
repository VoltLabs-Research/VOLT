import type { ComponentType } from 'react';

export interface MenuOption {
    label: string;
    icon?: ComponentType;
    onClick: () => void | Promise<void>;
    destructive?: boolean;
    disabled?: boolean;
};
