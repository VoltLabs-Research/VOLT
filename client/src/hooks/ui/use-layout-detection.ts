import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { getLayoutKey, detectSameLayout } from '@/utilities/layout';

const useLayoutDetection = (storageKey: string = 'previousLayoutKey') => {
    const location = useLocation();
    const currentLayoutKey = getLayoutKey(location.pathname);

    const isSameLayout = useMemo(() => 
        detectSameLayout(currentLayoutKey, storageKey), 
        [currentLayoutKey, storageKey]
    );

    return {
        currentLayoutKey,
        isSameLayout,
        pathname: location.pathname,
    };
};

export default useLayoutDetection;