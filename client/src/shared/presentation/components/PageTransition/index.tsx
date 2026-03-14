import './PageTransition.css';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import { useRef, useLayoutEffect } from 'react';
import type { PropsWithChildren } from 'react';

/**
 * Page-level enter transition.
 *
 * Uses CSS transitions instead of framer-motion so that the element
 * is guaranteed to start at opacity: 0 (set in the stylesheet) before
 * JavaScript runs.  After the first paint, a `useLayoutEffect` adds
 * the `.entered` class which triggers the CSS transition to opacity 1.
 *
 * Exit animations are handled by the parent (see DashboardLayout)
 * because they require delaying the unmount of the old content.
 */
const PageTransition = ({ children }: PropsWithChildren) => {
    const ref = useRef<HTMLDivElement>(null);
    const prefersReducedMotion = usePrefersReducedMotion();

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el || prefersReducedMotion) return;
        el.getBoundingClientRect();
        el.classList.add('entered');
    }, [prefersReducedMotion]);

    const className = prefersReducedMotion ? 'page-transition entered' : 'page-transition';

    return (
        <div ref={ref} className={className}>
            {children}
        </div>
    );
};

export default PageTransition;
