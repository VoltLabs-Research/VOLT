import type { Variants } from 'framer-motion';

export interface PageVariantsConfig {
    reducedMotion: boolean;
    isSameLayout: boolean;
};

export const SMOOTH_EASING = [0.25, 0.46, 0.45, 0.94] as const;
export const PREMIUM_EASING = [0.16, 1, 0.3, 1] as const;
export const BALANCED_EASING = [0.25, 0.1, 0.25, 1] as const;

export const ANIMATION_TIMINGS = {
    sameLayout: {
        enter: 0.6,
        exit: 0.35,
        opacity: 0.5,
        delay: 0.1,
    },
    differentLayout: {
        enter: 1.0,
        exit: 0.5,
        opacity: 0.8,
        delay: 0.2,
    },
} as const;

export const createPageVariants = ({ reducedMotion, isSameLayout }: PageVariantsConfig): Variants => {
    const timings = isSameLayout ? ANIMATION_TIMINGS.sameLayout : ANIMATION_TIMINGS.differentLayout;
    return {
        initial: {
            opacity: 0,
            y: reducedMotion ? 0 : (isSameLayout ? 12 : 25),
            scale: reducedMotion ? 1 : (isSameLayout ? 0.985 : 0.975),
            filter: reducedMotion ? 'none' : (isSameLayout ? 'blur(5px)' : 'blur(10px) brightness(1.05)'),
            rotateX: reducedMotion ? 0 : (isSameLayout ? 0 : -2.5),
            transformOrigin: '50% 0%',
        },
        enter: {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: 'blur(0px) brightness(1)',
            rotateX: 0,
            transformOrigin: '50% 50%',
            transition: {
                duration: timings.enter,
                ease: BALANCED_EASING,
                opacity: {
                    duration: timings.opacity,
                    ease: BALANCED_EASING,
                },
                y: { duration: timings.enter * 0.8, ease: BALANCED_EASING },
                scale: { duration: timings.enter * 0.9, ease: BALANCED_EASING },
                filter: { duration: timings.enter * 0.6, ease: SMOOTH_EASING },
                rotateX: { duration: isSameLayout ? 0 : timings.enter * 0.8, ease: BALANCED_EASING },
            },
        },
        exit: {
            opacity: 0,
            y: reducedMotion ? 0 : (isSameLayout ? -8 : -18),
            scale: reducedMotion ? 1 : (isSameLayout ? 1.015 : 1.025),
            filter: reducedMotion ? 'none' : (isSameLayout ? 'blur(3px)' : 'blur(8px) brightness(0.95)'),
            rotateX: reducedMotion ? 0 : (isSameLayout ? 0 : 2),
            transition: {
                duration: timings.exit,
                ease: SMOOTH_EASING,
                opacity: { duration: timings.exit * 0.7, ease: SMOOTH_EASING },
            },
        },
    };
};

export const createOverlayVariants = (isSameLayout: boolean): Variants => {
    const timings = isSameLayout ? ANIMATION_TIMINGS.sameLayout : ANIMATION_TIMINGS.differentLayout;

    return {
        initial: {
            opacity: 0,
        },
        animate: {
            opacity: isSameLayout ? 0.6 : 1,
            transition: {
                duration: timings.enter * 0.8,
                ease: BALANCED_EASING,
                delay: timings.delay * 0.5,
                opacity: { duration: timings.opacity * 0.8, ease: BALANCED_EASING },
            },
        },
        exit: {
            opacity: 0,
            transition: {
                duration: timings.exit * 0.8,
                ease: SMOOTH_EASING,
            },
        },
    };
};

export const createContentVariants = (isSameLayout: boolean): Variants => {
    const timings = isSameLayout ? ANIMATION_TIMINGS.sameLayout : ANIMATION_TIMINGS.differentLayout;

    return {
        initial: { opacity: 0, y: isSameLayout ? 10 : 18 },
        animate: {
            opacity: 1,
            y: 0,
            transition: {
                duration: timings.enter * 0.8,
                ease: BALANCED_EASING,
                delay: timings.delay,
                staggerChildren: isSameLayout ? 0.08 : 0.12,
                opacity: { duration: timings.opacity * 0.8, ease: BALANCED_EASING },
            },
        },
    };
};
