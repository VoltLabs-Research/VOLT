import { useStartAccessedPagesStore } from '../stores/use-start-accessed-pages-store';
import { capturePageSnapshot } from '../utilities/page-snapshot';
import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { fadeFromBlack } from '@/shared/presentation/utilities/page-transition';

const EXCLUDED_PATHS = ['/start', '/auth/sign-in', '/auth/oauth/callback', '/error'];

export const usePageTracker = () => {
    const location = useLocation();
    const addPage = useStartAccessedPagesStore((state) => state.addPage);
    const currentPageRef = useRef<{ path: string; title: string } | null>(null);

    const persistCurrent = useCallback(() => {
        const page = currentPageRef.current;
        if (!page) return;
        const snapshot = capturePageSnapshot();
        if (snapshot) addPage(page.path, page.title, snapshot);
    }, [addPage]);

    useEffect(() => {
        fadeFromBlack();

        const path = location.pathname;

        if (!path || EXCLUDED_PATHS.some((excludedPath) => path === excludedPath || path.startsWith(excludedPath + '/'))) {
            currentPageRef.current = null;
            return;
        }

        const title = path;
        currentPageRef.current = { path, title };
        addPage(path, title);

        const fallbackTimeout = window.setTimeout(persistCurrent, 1500);

        return () => {
            window.clearTimeout(fallbackTimeout);
            persistCurrent();
        };
    }, [location.pathname, addPage, persistCurrent]);

    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') persistCurrent();
        };

        window.addEventListener('pagehide', persistCurrent);
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            window.removeEventListener('pagehide', persistCurrent);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [persistCurrent]);
};
