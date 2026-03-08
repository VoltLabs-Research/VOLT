import { useStartAccessedPagesStore } from '../stores/use-start-accessed-pages-store';
import { capturePageSnapshot } from '../utilities/page-snapshot';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { fadeFromBlack } from '@/shared/presentation/utilities/page-transition';

const EXCLUDED_PATHS = ['/start', '/auth/sign-in', '/auth/oauth/callback', '/error'];

export const usePageTracker = () => {
    const location = useLocation();
    const addPage = useStartAccessedPagesStore((state) => state.addPage);
    const latestSnapshotRef = useRef<string | null>(null);
    const currentPageRef = useRef<{ path: string; title: string } | null>(null);

    useEffect(() => {
        fadeFromBlack();

        const path = location.pathname;

        if (!path || EXCLUDED_PATHS.some((excludedPath) => path === excludedPath || path.startsWith(excludedPath + '/'))) {
            return;
        }

        const title = path;
        currentPageRef.current = { path, title };
        latestSnapshotRef.current = null;

        addPage(path, title);

        let isCancelled = false;

        const tick = () => {
            if (isCancelled) {
                return;
            }

            const snapshot = capturePageSnapshot();

            if (!isCancelled && snapshot) {
                latestSnapshotRef.current = snapshot;
                addPage(path, title, snapshot);
            }
        };

        const firstTimeout = window.setTimeout(tick, 800);
        const secondTimeout = window.setTimeout(tick, 3000);

        return () => {
            isCancelled = true;
            window.clearTimeout(firstTimeout);
            window.clearTimeout(secondTimeout);

            const page = currentPageRef.current;
            const snapshot = latestSnapshotRef.current;

            if (page && snapshot) {
                addPage(page.path, page.title, snapshot);
            }
        };
    }, [location.pathname, addPage]);
};
