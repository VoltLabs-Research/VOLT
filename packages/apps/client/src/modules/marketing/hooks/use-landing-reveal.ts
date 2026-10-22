import { useEffect, useRef } from 'react';

const STAGGER_MS = 80;
const STAGGER_CAP_MS = 320;

// Rises each `.landing-rise` into view once, its siblings a beat apart. Without
// IntersectionObserver nothing is hidden: the attribute that hides them is never set.
export const useLandingReveal = () => {
    const root = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const container = root.current;
        if (!container || !('IntersectionObserver' in window)) {
            return;
        }

        container.dataset.animate = 'true';

        const watcher = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) {
                    continue;
                }

                const element = entry.target as HTMLElement;
                const siblings = [...(element.parentElement?.children ?? [])]
                    .filter((node) => node.classList.contains('landing-rise'));
                const delay = Math.min(Math.max(0, siblings.indexOf(element)) * STAGGER_MS, STAGGER_CAP_MS);

                window.setTimeout(() => {
                    element.dataset.shown = 'true';
                }, delay);
                watcher.unobserve(element);
            }
        }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });

        for (const element of container.querySelectorAll('.landing-rise')) {
            watcher.observe(element);
        }

        return () => watcher.disconnect();
    }, []);

    return root;
};
