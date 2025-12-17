import React, { type ReactNode } from 'react';
import Button from '@/components/primitives/Button';
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
        <Button
            variant='ghost'
            intent={variant === 'danger' ? 'danger' : 'neutral'}
            size='sm'
            block
            align='start'
            className={`popover-menu-item ${disabled ? 'disabled' : ''} font-size-2 color-primary u-select-none cursor-pointer`}
            onClick={onClick}
            disabled={disabled}
            leftIcon={icon ? <span className="popover-menu-item-icon d-flex flex-center f-shrink-0 font-size-3">{icon}</span> : undefined}
        >
            {children}
        </Button>
    );
};

export default PopoverMenuItem;


