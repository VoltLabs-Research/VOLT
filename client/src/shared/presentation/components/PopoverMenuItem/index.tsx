import React from 'react';
import Button from '@/shared/presentation/components/Button';
import './PopoverMenuItem.css';

interface PopoverMenuItemProps {
    icon?: React.ReactNode;
    label?: string;
    children?: React.ReactNode;
    onClick?: () => void;
    variant?: 'default' | 'danger';
    size?: 'sm' | 'md';
    disabled?: boolean;
    isLoading?: boolean;
};

const PopoverMenuItem: React.FC<PopoverMenuItemProps> = ({
    icon,
    label,
    children,
    onClick,
    variant = 'default',
    size = 'md',
    disabled = false,
    isLoading = false
}) => {
    const content = children ?? label;

    return (
        <Button
            variant='ghost'
            intent={variant === 'danger' ? 'danger' : 'neutral'}
            size='sm'
            block
            align='start'
            className={`popover-menu-item popover-menu-item--${size} radius-sm color-primary u-select-none cursor-pointer`}
            onClick={isLoading ? undefined : onClick}
            disabled={disabled || isLoading}
            isLoading={isLoading}
            leftIcon={icon ? <span className='popover-menu-item-icon d-flex items-center content-center f-shrink-0 font-size-3'>{icon}</span> : undefined}
        >
            {content}
        </Button>
    );
};

export default PopoverMenuItem;
