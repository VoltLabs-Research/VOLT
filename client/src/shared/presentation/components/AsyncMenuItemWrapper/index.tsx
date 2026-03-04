import { useState } from 'react';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import type { MenuOption } from '@/shared/presentation/components/DocumentListingTable';
import { sileo } from 'sileo';
import ApiError from '@/shared/errors/ApiError';

interface AsyncMenuItemWrapperProps {
    option: MenuOption;
};

const AsyncMenuItemWrapper: React.FC<AsyncMenuItemWrapperProps> = ({ option }) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async () => {
        try{
            setIsLoading(true);
            await option.onClick();
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
            isLoading={isLoading}
        >
            {option.label}
        </PopoverMenuItem>
    );
};

export default AsyncMenuItemWrapper;
