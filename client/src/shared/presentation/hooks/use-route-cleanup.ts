import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { runRouteCleanup } from '@/shared/utils/app-cleanup-registry';

interface UseRouteCleanupOptions {
    shouldCleanup?: (previousPathname: string, nextPathname: string) => boolean;
}

export const useRouteCleanup = (options?: UseRouteCleanupOptions): void => {
    const location = useLocation();
    const previousPathnameRef = useRef(location.pathname);
    const shouldCleanupRef = useRef(options?.shouldCleanup);

    useEffect(() => {
        shouldCleanupRef.current = options?.shouldCleanup;
    }, [options?.shouldCleanup]);

    useEffect(() => {
        const previousPathname = previousPathnameRef.current;
        const nextPathname = location.pathname;

        if (previousPathname === nextPathname) {
            return;
        }

        let shouldCleanup = true;
        const evaluateCleanup = shouldCleanupRef.current;

        if (evaluateCleanup) {
            shouldCleanup = evaluateCleanup(previousPathname, nextPathname);
        }

        if (shouldCleanup) {
            runRouteCleanup(previousPathname, nextPathname);
        }

        previousPathnameRef.current = nextPathname;
    }, [location.pathname]);
};
