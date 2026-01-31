import { useState } from 'react';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import type { MenuOption } from '@/shared/presentation/components/DocumentListingTable';

interface AsyncMenuItemWrapperProps {
    option: MenuOption;
};

const AsyncMenuItemWrapper: React.FC<AsyncMenuItemWrapperProps> = ({ option }) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async () => {
        try{
            setIsLoading(true);
            await option.onClick();
        }catch(error){
            console.error(error);
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
