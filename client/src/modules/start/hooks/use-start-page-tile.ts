import { useStartAccessedPagesStore } from '../stores/use-start-accessed-pages-store';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fadeToBlack } from '@/shared/presentation/utilities/page-transition';
import type { MouseEvent } from 'react';

const IFRAME_W = 1280;
const IFRAME_H = 800;
const TILT_MAX = 8;
const SCALE_HOVER = 1.03;

export const useStartPageTile = (path: string) => {
    const removePage = useStartAccessedPagesStore((state) => state.removePage);
    const navigate = useNavigate();
    const prefersReducedMotion = usePrefersReducedMotion();
    const tileRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);
    const isAnimatingRef = useRef(false);
    const transitionTimeoutRef = useRef<number | null>(null);
    const [iframeScale, setIframeScale] = useState(1);

    useEffect(() => {
        const tile = tileRef.current;

        if (!tile) {
            return;
        }

        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            const scale = Math.max(width / IFRAME_W, height / IFRAME_H);
            setIframeScale(scale);
        });

        observer.observe(tile);

        return () => {
            observer.disconnect();

            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }

            if (transitionTimeoutRef.current) {
                window.clearTimeout(transitionTimeoutRef.current);
            }
        };
    }, []);

    const handleRemove = useCallback((event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        removePage(path);
    }, [path, removePage]);

    const handleClick = useCallback(async () => {
        if (isAnimatingRef.current) {
            return;
        }

        isAnimatingRef.current = true;

        try {
            await fadeToBlack();
            navigate(path);
        } finally {
            isAnimatingRef.current = false;
        }
    }, [navigate, path]);

    const handleMouseMove = useCallback((event: MouseEvent<HTMLDivElement>) => {
        const tile = tileRef.current;

        if (!tile || prefersReducedMotion) {
            return;
        }

        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
        }

        rafRef.current = requestAnimationFrame(() => {
            const rect = tile.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const normalX = (x - centerX) / centerX;
            const normalY = (y - centerY) / centerY;

            const rotateY = normalX * TILT_MAX;
            const rotateX = -normalY * TILT_MAX;

            tile.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${SCALE_HOVER}, ${SCALE_HOVER}, 1)`;
            tile.style.setProperty('--mouse-x', `${(x / rect.width) * 100}%`);
            tile.style.setProperty('--mouse-y', `${(y / rect.height) * 100}%`);
        });
    }, [prefersReducedMotion]);

    const handleMouseLeave = useCallback(() => {
        const tile = tileRef.current;

        if (!tile) {
            return;
        }

        if (prefersReducedMotion) {
            tile.style.transition = '';
            tile.style.transform = '';
            return;
        }

        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
        }

        if (transitionTimeoutRef.current) {
            window.clearTimeout(transitionTimeoutRef.current);
        }

        tile.style.transition = 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
        tile.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';

        transitionTimeoutRef.current = window.setTimeout(() => {
            tile.style.transition = '';
            transitionTimeoutRef.current = null;
        }, 600);
    }, [prefersReducedMotion]);

    const handleMouseEnter = useCallback(() => {
        const tile = tileRef.current;

        if (!tile || prefersReducedMotion) {
            return;
        }

        if (transitionTimeoutRef.current) {
            window.clearTimeout(transitionTimeoutRef.current);
            transitionTimeoutRef.current = null;
        }

        tile.style.transition = '';
    }, [prefersReducedMotion]);

    return {
        tileRef,
        iframeScale,
        handleClick,
        handleMouseEnter,
        handleMouseLeave,
        handleMouseMove,
        handleRemove
    };
};
