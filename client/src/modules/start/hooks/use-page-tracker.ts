import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { fadeFromBlack } from '@/shared/presentation/utilities/page-transition';
import { useStartAccessedPagesStore } from '../stores/use-start-accessed-pages-store';

const EXCLUDED_PATHS = ['/start', '/auth/sign-in', '/auth/oauth/callback', '/error'];

const captureHTMLSnapshot = (): string | null => {
    try {
        let allCSS = '';

        for (const sheet of Array.from(document.styleSheets)) {
            try {
                for (const rule of Array.from(sheet.cssRules)) {
                    allCSS += rule.cssText + '\n';
                }
            } catch {
                continue;
            }
        }

        const rootAttrs = document.documentElement.getAttributeNames()
            .filter((name) => name !== 'xmlns')
            .map((name) => `${name}="${(document.documentElement.getAttribute(name) || '').replace(/"/g, '&quot;')}"`)
            .join(' ');

        const bodyAttrs = document.body.getAttributeNames()
            .map((name) => `${name}="${(document.body.getAttribute(name) || '').replace(/"/g, '&quot;')}"`)
            .join(' ');

        const html = `<!DOCTYPE html>
<html ${rootAttrs}>
<head>
<style>
${allCSS}
* { pointer-events: none !important; cursor: default !important; user-select: none !important; }
::-webkit-scrollbar { display: none !important; }
body { overflow: hidden !important; margin: 0 !important; }
</style>
</head>
<body ${bodyAttrs}>${document.body.innerHTML}</body>
</html>`;

        return html.replace(/<script[\s\S]*?<\/script>/gi, '');
    } catch {
        return null;
    }
};

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

            const snapshot = captureHTMLSnapshot();

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
