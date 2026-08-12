import Loader from '@/shared/ui/components/Loader';
import { cn } from '@heroui/react';
import { forwardRef } from 'react';
import type { FocusEventHandler, KeyboardEventHandler, MouseEventHandler, ReactNode } from 'react';

export type ContextMenuItemSize = 'sm' | 'md';
export type ContextMenuItemVariant = 'default' | 'danger';
export type ContextMenuItemRole = 'menuitem' | 'menuitemcheckbox' | 'menuitemradio';

export interface ContextMenuItemProps {
    icon?: ReactNode;
    label?: string;
    children?: ReactNode;
    onClick?: () => void;
    variant?: ContextMenuItemVariant;
    size?: ContextMenuItemSize;
    disabled?: boolean;
    isLoading?: boolean;
    rightAdornment?: ReactNode;
    role?: ContextMenuItemRole;
    ariaHaspopup?: 'menu' | 'dialog';
    ariaExpanded?: boolean;
    ariaControls?: string;
    tabIndex?: number;
    onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
    onBlur?: FocusEventHandler<HTMLButtonElement>;
    onMouseEnter?: MouseEventHandler<HTMLButtonElement>;
    onMouseLeave?: MouseEventHandler<HTMLButtonElement>;
};

const ContextMenuItem = forwardRef<HTMLButtonElement, ContextMenuItemProps>(({
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
    const isInert = disabled || isLoading;

    return (
        <button
            ref={ref}
            type='button'
            className={cn(
                'relative flex w-full cursor-pointer select-none items-center justify-start font-medium transition-colors duration-150',
                'disabled:cursor-not-allowed disabled:opacity-50',
                { sm: 'min-h-[2.1rem] gap-2 rounded-md px-3.5 py-2 text-sm', md: 'min-h-[2.75rem] gap-2 rounded-xl px-3.5 text-sm' }[size],
                { default: 'text-muted hover:bg-surface-hover hover:text-foreground', danger: 'text-danger hover:bg-danger/8' }[variant],
                isLoading && 'pointer-events-none text-transparent'
            )}
            disabled={isInert}
            role={role}
            aria-haspopup={ariaHaspopup}
            aria-expanded={ariaExpanded}
            aria-controls={ariaControls}
            aria-disabled={isInert}
            aria-busy={isLoading || undefined}
            tabIndex={tabIndex}
            data-popover-menu-item='true'
            onClick={isLoading ? undefined : onClick}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {isLoading && (
                <span className='absolute inset-0 flex items-center justify-center text-muted'>
                    <Loader size='sm' />
                </span>
            )}

            {icon && (
                <span className='flex shrink-0 items-center justify-center' aria-hidden='true'>
                    {icon}
                </span>
            )}

            <span className='flex w-full items-center justify-between gap-2'>
                <span>{content}</span>
                {rightAdornment ? (
                    <span className='flex shrink-0 items-center justify-center'>{rightAdornment}</span>
                ) : null}
            </span>
        </button>
    );
});

ContextMenuItem.displayName = 'ContextMenuItem';

export default ContextMenuItem;
