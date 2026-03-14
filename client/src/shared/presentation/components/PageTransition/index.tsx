import './PageTransition.css';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';

/**
 * Page-level enter transition.
 *
 * Uses CSS transitions instead of framer-motion so that the element
 * is guaranteed to start at opacity: 0 (set in the stylesheet) before
 * JavaScript runs. After the first paint, a `requestAnimationFrame`
 * toggles the `.entered` class without forcing a layout read.
 *
 * Exit animations are handled by the parent (see DashboardLayout)
 * because they require delaying the unmount of the old content.
 */
const PageTransition = ({ children }: PropsWithChildren) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const [isEntered, setIsEntered] = useState(prefersReducedMotion);

    useEffect(() => {
        if (prefersReducedMotion) {
            setIsEntered(true);
            return;
        }

        setIsEntered(false);
        const animationFrameId = window.requestAnimationFrame(() => {
            setIsEntered(true);
        });

        return () => {
            window.cancelAnimationFrame(animationFrameId);
        };
    }, [prefersReducedMotion]);

    const className = isEntered ? 'page-transition entered' : 'page-transition';

    return (
        <div className={className}>
            {children}
        </div>
    );
};

export default PageTransition;
