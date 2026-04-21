import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import { useState } from 'react';
import type { MenuOption } from '@/shared/presentation/types/menu';

interface AsyncMenuItemWrapperProps {
    option: MenuOption;
    onSuccess?: () => void;
    size?: 'sm' | 'md';
};

const MENU_ICON_SIZES: Record<'sm' | 'md', number> = {
    sm: 14,
    md: 16
};

const AsyncMenuItemWrapper = ({ option, onSuccess, size = 'md' }: AsyncMenuItemWrapperProps) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async () => {
        try{
            setIsLoading(true);
            await option.onClick?.();
            onSuccess?.();
        }catch(error: unknown){
            if(isAccessDeniedError(error)){
                reportError(error, {
                    surface: ErrorSurface.Toast,
                    fallbackTitle: 'You do not have permission to perform this action.'
                });
            } else {
                reportError(error, {
                    surface: ErrorSurface.Toast,
                    fallbackTitle: `${option.label} failed`
                });
            }
        }finally{
            setIsLoading(false);
        }
    };

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

export default AsyncMenuItemWrapper;
