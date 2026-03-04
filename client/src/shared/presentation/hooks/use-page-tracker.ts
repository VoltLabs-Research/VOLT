import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAccessedPagesStore } from '../stores/use-accessed-pages-store';
import { fadeFromBlack } from '../utils/page-transition';

const EXCLUDED_PATHS = ['/start', '/auth/sign-in', '/auth/oauth/callback', '/error'];

/**
 * Captures a frozen HTML+CSS snapshot of the current page.
 * - Synchronous: just reads the DOM, no canvas/image encoding
 * - Zero CORS issues: no external resource loading
 * - Zero DOM pollution: nothing is injected
 * - The result is a complete HTML document string with inlined CSS
 */
function captureHTMLSnapshot(): string | null {
    try {
        let allCSS = '';
        for (const sheet of Array.from(document.styleSheets)) {
            try {
                for (const rule of Array.from(sheet.cssRules)) {
                    allCSS += rule.cssText + '\n';
                }
            } catch {
                // CORS-restricted stylesheet — skip
            }
        }

        const rootAttrs = document.documentElement.getAttributeNames()
            .filter(n => n !== 'xmlns')
            .map(n => `${n}="${(document.documentElement.getAttribute(n) || '').replace(/"/g, '&quot;')}"`)
            .join(' ');

        const bodyAttrs = document.body.getAttributeNames()
            .map(n => `${n}="${(document.body.getAttribute(n) || '').replace(/"/g, '&quot;')}"`)
            .join(' ');

        const bodyHTML = document.body.innerHTML;

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
<body ${bodyAttrs}>${bodyHTML}</body>
</html>`;

        return html.replace(/<script[\s\S]*?<\/script>/gi, '');
    } catch {
        return null;
    }
}

export const usePageTracker = () => {
    const location = useLocation();
    const addPage = useAccessedPagesStore((state) => state.addPage);
    const latestSnapshotRef = useRef<string | null>(null);
    const currentPageRef = useRef<{ path: string; title: string } | null>(null);

    useEffect(() => {
        fadeFromBlack();
        const path = location.pathname;

        if (!path || EXCLUDED_PATHS.some(ex => path === ex || path.startsWith(ex + '/'))) {
            return;
        }

        const title = path;
        currentPageRef.current = { path, title };
        latestSnapshotRef.current = null;

        addPage(path, title);

        let isCancelled = false;

        const tick = () => {
            if (isCancelled) return;
            const snap = captureHTMLSnapshot();
            if (!isCancelled && snap) {
                latestSnapshotRef.current = snap;
                addPage(path, title, snap);
            }
        };

        // Capture after React has rendered the page content
        const t1 = setTimeout(tick, 800);
        // Second pass to capture after async data has loaded
        const t2 = setTimeout(tick, 3000);

        return () => {
            isCancelled = true;
            clearTimeout(t1);
            clearTimeout(t2);
            const page = currentPageRef.current;
            const snap = latestSnapshotRef.current;
            if (page && snap) {
                addPage(page.path, page.title, snap);
            }
        };
    }, [location.pathname, addPage]);
};
