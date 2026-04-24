import Button from '@/shared/presentation/primitives/Button';
import './PopoverMenuItem.css';
import { forwardRef } from 'react';
import type { ReactNode } from 'react';

type PopoverMenuItemRole = 'menuitem' | 'menuitemcheckbox' | 'menuitemradio';

interface PopoverMenuItemProps {
    icon?: ReactNode;
    label?: string;
    children?: ReactNode;
    onClick?: () => void;
    variant?: 'default' | 'danger';
    size?: 'sm' | 'md';
    disabled?: boolean;
    isLoading?: boolean;
    rightAdornment?: ReactNode;
    role?: PopoverMenuItemRole;
    ariaHaspopup?: 'menu' | 'dialog';
    ariaExpanded?: boolean;
    ariaControls?: string;
    tabIndex?: number;
    onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
    onBlur?: React.FocusEventHandler<HTMLButtonElement>;
    onMouseEnter?: React.MouseEventHandler<HTMLButtonElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLButtonElement>;
};

const PopoverMenuItem = forwardRef<HTMLButtonElement, PopoverMenuItemProps>(({
    icon,
    label,
    children,
    onClick,
    variant = 'default',
    size = 'md',
    disabled = false,
    isLoading = false,
    rightAdornment,
    role = 'menuitem',
    ariaHaspopup,
    ariaExpanded,
    ariaControls,
    tabIndex = -1,
    onKeyDown,
    onBlur,
    onMouseEnter,
    onMouseLeave
}, ref) => {
    const content = children ?? label;

    return (
        <Button
            ref={ref}
            variant='ghost'
            intent={variant === 'danger' ? 'danger' : 'neutral'}
            size={size}
            block
            align='start'
            className={`popover-menu-item popover-menu-item--${size} radius-sm color-primary u-select-none cursor-pointer`}
            onClick={isLoading ? undefined : onClick}
            disabled={disabled || isLoading}
            isLoading={isLoading}
            role={role}
            aria-haspopup={ariaHaspopup}
            aria-expanded={ariaExpanded}
            aria-controls={ariaControls}
            aria-disabled={disabled || isLoading}
            tabIndex={tabIndex}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            data-popover-menu-item='true'
            leftIcon={icon ? <span className='popover-menu-item-icon d-flex items-center content-center f-shrink-0'>{icon}</span> : undefined}
        >
            <span className='popover-menu-item-content d-flex items-center content-between gap-05 w-max'>
                <span className='popover-menu-item-label'>{content}</span>
                {rightAdornment ? <span className='popover-menu-item-adornment d-flex items-center content-center f-shrink-0'>{rightAdornment}</span> : null}
            </span>
        </Button>
    );
});

PopoverMenuItem.displayName = 'PopoverMenuItem';

export default PopoverMenuItem;
