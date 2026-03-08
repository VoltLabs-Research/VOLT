import ApiError from '@/shared/errors/ApiError';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import { useState } from 'react';
import { sileo } from 'sileo';
import type { MenuOption } from '@/shared/presentation/types/menu';

interface AsyncMenuItemWrapperProps {
    option: MenuOption;
    onSuccess?: () => void;
    size?: 'sm' | 'md';
};

const AsyncMenuItemWrapper: React.FC<AsyncMenuItemWrapperProps> = ({ option, onSuccess, size = 'md' }) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async () => {
        try{
            setIsLoading(true);
            await option.onClick();
            onSuccess?.();
        }catch(error: unknown){
            if(ApiError.isRBACError(error)){
                const msg = error instanceof ApiError ? error.getFriendlyMessage() : 'You do not have permission to perform this action.';
                sileo.error({ title: msg });
            } else {
                sileo.error({ title: `${option.label} failed` });
            }
        }finally{
            setIsLoading(false);
        }
    };

    return (
        <PopoverMenuItem
            icon={option.icon ? <option.icon /> : undefined}
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
