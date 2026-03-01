import { useRef, useLayoutEffect, type PropsWithChildren } from 'react';
import './PageTransition.css';

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

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.getBoundingClientRect();
        el.classList.add('entered');
    }, []);

    return (
        <div ref={ref} className='page-transition'>
            {children}
        </div>
    );
};

export default PageTransition;
