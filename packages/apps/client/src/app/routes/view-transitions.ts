import { dashboardPageKey } from '@/modules/dashboard/utils/page-key';
import type { RouterNavigateOptions, To, createBrowserRouter } from 'react-router-dom';

type DataRouter = ReturnType<typeof createBrowserRouter>;

// Relative targets (search params, "..") stay where they are, so only absolute paths can change the page.
const pathnameOf = (to: To): string | null => {
    const pathname = typeof to === 'string' ? to.replace(/[?#].*$/u, '') : to.pathname;

    return pathname?.startsWith('/') ? pathname : null;
};

const prefersReducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// React Router starts each transition and observes only `finished`. A page change that begins while
// another animates (a redirect, a quick second click) skips the running transition, whose `ready`
// then rejects unobserved, and GlobalErrorListener would take that for a crash.
const OBSERVED: unique symbol = Symbol.for('volt.view-transitions.observed');

const observeSkippedTransitions = (): void => {
    // A registered symbol outlives a hot reload of this module, so the wrapper is never stacked.
    const target = document as Document & { [OBSERVED]?: true };
    if (typeof document.startViewTransition !== 'function' || target[OBSERVED]) return;

    target[OBSERVED] = true;
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = (callback) => {
        const transition = start(callback);
        transition.ready.catch(() => undefined);
        return transition;
    };
};

/**
 * Every navigation from one dashboard page to another runs as a View Transition, the way the
 * framer fade around the outlet used to: the page leaves blurring and the next one rises in, and
 * the sidebar's active pill slides to its new item (index.css, shell chrome). A caller can still
 * opt out with `viewTransition: false`.
 */
export const withViewTransitions = (router: DataRouter): DataRouter => {
    observeSkippedTransitions();
    const navigate = router.navigate.bind(router);

    const navigateWithTransition = (to: To | number | null, options?: RouterNavigateOptions): Promise<void> => {
        if (typeof to === 'number') return navigate(to);
        if (to === null || options?.viewTransition !== undefined) return navigate(to, options);

        const from = dashboardPageKey(router.state.location.pathname);
        const next = pathnameOf(to);
        const nextPage = next === null ? null : dashboardPageKey(next);
        const viewTransition = from !== null && nextPage !== null && nextPage !== from && !prefersReducedMotion();

        return navigate(to, { ...options, viewTransition });
    };

    router.navigate = navigateWithTransition as DataRouter['navigate'];

    return router;
};
