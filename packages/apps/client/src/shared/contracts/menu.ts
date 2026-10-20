import type { ComponentType, ReactNode } from 'react';

export interface MenuIconProps {
    size?: number | string;
    className?: string;
};

export interface MenuOption {
    label: string;
    icon?: ComponentType<MenuIconProps>;
    onClick?: () => void | Promise<void>;
    destructive?: boolean;
    disabled?: boolean;
    submenuContent?: ReactNode;
};
