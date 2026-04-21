import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import { useCallback, useState } from 'react';
import type { MenuOption } from '@/shared/presentation/types/menu';

interface AsyncContextMenuItemProps {
    option: MenuOption;
    onClose?: () => void;
    onError?: (message: string | null) => void;
    size?: 'sm' | 'md';
};

const MENU_ICON_SIZES: Record<'sm' | 'md', number> = {
    sm: 14,
    md: 16
};

const AsyncContextMenuItem = ({
    option,
    onClose,
    onError,
    size = 'md'
}: AsyncContextMenuItemProps) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = useCallback(async () => {
        if (!option.onClick) {
            return;
        }

        setIsLoading(true);
        onError?.(null);

        try {
            await option.onClick();
            onClose?.();
        } catch (error: unknown) {
            const userError = reportError(error, {
                surface: ErrorSurface.Silent,
                fallbackTitle: isAccessDeniedError(error)
                    ? 'You do not have permission to perform this action.'
                    : `${option.label} failed`
            });

            onError?.(userError.description ?? userError.title);
        } finally {
            setIsLoading(false);
        }
    }, [onClose, onError, option]);

    const menuIcon = option.icon
        ? <option.icon size={MENU_ICON_SIZES[size]} />
        : undefined;

    return (
        <PopoverMenuItem
            icon={menuIcon}
            onClick={handleClick}
            variant={option.destructive ? 'danger' : 'default'}
            size={size}
            disabled={option.disabled}
            isLoading={isLoading}
        >
            {option.label}
        </PopoverMenuItem>
    );
};

export default AsyncContextMenuItem;
