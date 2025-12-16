import React, { type ReactNode } from 'react';
import './PopoverMenuItem.css';

interface PopoverMenuItemProps {
    onClick?: () => void;
    icon?: ReactNode;
    children: ReactNode;
    variant?: 'default' | 'danger';
    disabled?: boolean;
}

const PopoverMenuItem = ({
    onClick,
    icon,
    children,
    variant = 'default',
    disabled = false
}: PopoverMenuItemProps) => {
    return (
        <button
            className={`popover-menu-item d-flex items-center gap-05 w-max ${variant} ${disabled ? 'disabled' : ''}`}
            onClick={onClick}
            disabled={disabled}
            type="button"
        >
            {icon && <span className="popover-menu-item-icon d-flex items-center content-center f-shrink-0">{icon}</span>}
            <span className="popover-menu-item-label flex-1">{children}</span>
        </button>
    );
};

export default PopoverMenuItem;
