import { useState } from 'react';

const useCardInteractions = (
    onSelect?: (itemId: string) => void, 
    onNavigate?: (itemId: string) => void, 
    hasJobs?: boolean
): any => {
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    const handleClick = (event: React.MouseEvent, itemId: string): void => {
        const target = event.target as HTMLElement;
        if(target.closest('.simulation-options-icon-container') || 
            target.closest('.simulation-caption-title') ||
            target.closest('.action-based-floating-container-element-wrapper') ||
            hasJobs
        ){
            return;
        }

        if(event.ctrlKey || event.metaKey){
            event.preventDefault();
            onSelect?.(itemId);
        }else{
            onNavigate?.(itemId);
        }
    };

    const handleDelete = (
        itemId: string,
        deleteCallback: (id: string) => void,
        cleanup?: () => void
    ): void => {
        cleanup?.();
        setIsDeleting(true);
        setTimeout(() => {
            deleteCallback(itemId);
        }, 500);
    };

    return {
        isDeleting,
        handleClick,
        handleDelete
    }
};

export default useCardInteractions;