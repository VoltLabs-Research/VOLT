import { useState } from 'react';

const useCardInteractions = (
    onSelect?: (itemId: string) => void,
    onNavigate?: (itemId: string) => void,
    isNavigationDisable?: boolean
): any => {
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    const handleClick = (event: React.MouseEvent, itemId: string): void => {
        const target = event.target as HTMLElement;

        // Don't process if clicking on interactive elements
        if(target.closest('.simulation-options-icon-container') ||
            target.closest('.simulation-caption-title') ||
            target.closest('.action-based-floating-container-element-wrapper')
        ){
            return;
        }

        // Check if we're clicking on an image(should still allow Ctrl+Click)
        // Only prevent normal navigation on image, but allow selection
        const isImageClick = target instanceof HTMLImageElement || target.closest('.simulation-image');

        // Handle Ctrl+Click for selection(always allowed)
        if(event.ctrlKey || event.metaKey){
            event.preventDefault();
            onSelect?.(itemId);
            return;
        }

        // Handle normal click for navigation(disabled on processing or image)
        if(!isNavigationDisable && !isImageClick){
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
