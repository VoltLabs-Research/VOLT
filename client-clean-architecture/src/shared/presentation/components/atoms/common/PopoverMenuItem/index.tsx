import React, { type ReactNode } from 'react';
import Button from '@/shared/presentation/components/primitives/Button';
import Loader from '@/shared/presentation/components/atoms/common/Loader';
import '@/shared/presentation/components/atoms/common/PopoverMenuItem/PopoverMenuItem.css';

interface PopoverMenuItemProps {
    onClick?: () => void;
    icon?: ReactNode;
    children: ReactNode;
    variant?: 'default' | 'danger';
    disabled?: boolean;
    isLoading?: boolean;
}

const PopoverMenuItem = ({
    onClick,
    icon,
    children,
    variant = 'default',
    disabled = false,
    isLoading = false
}: PopoverMenuItemProps) => {
    return (
        <Button
            variant='ghost'
            intent={variant === 'danger' ? 'danger' : 'neutral'}
            size='sm'
            block
            align='start'
            className={`popover-menu-item ${disabled || isLoading ? 'disabled' : ''} font-size-2 color-primary u-select-none cursor-pointer`}
            onClick={isLoading ? undefined : onClick}
            disabled={disabled || isLoading}
            leftIcon={icon ? <span className="popover-menu-item-icon d-flex flex-center f-shrink-0 font-size-3">{icon}</span> : undefined}
            rightIcon={isLoading ? <Loader scale={0.4} /> : undefined}
        >
            {children}
        </Button>
    );
};

export default PopoverMenuItem;
