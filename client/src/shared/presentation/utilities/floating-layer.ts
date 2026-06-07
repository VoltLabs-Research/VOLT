import {
    getFloatingOwnerIdsAttribute,
    useFloatingOwnerIds,
    useTopLayerRoot
} from '@/shared/presentation/contexts/FloatingRootContext';
import { size } from '@floating-ui/react';

export const matchReferenceWidth = (padding = 8) => {
    return size({
        apply({ rects, elements }) {
            Object.assign(elements.floating.style, {
                minWidth: `${rects.reference.width}px`
            });
        },
        padding
    });
};

export const useFloatingLayerRoot = () => {
    const floatingRoot = useTopLayerRoot();
    const floatingOwnerIds = useFloatingOwnerIds();
    const floatingOwnerIdsAttribute = getFloatingOwnerIdsAttribute(floatingOwnerIds);

    return {
        floatingRoot,
        floatingOwnerIdsAttribute
    };
};
