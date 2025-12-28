import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { createPageVariants, createContentVariants } from '@/utilities/animations/animation';
import useLayoutDetection from '@/hooks/ui/use-layout-detection';
import PageOverlay from '@/components/atoms/animations/PageOverlay';
import ShineEffect from '@/components/atoms/animations/ShineEffect';

interface PageWrapperProps {
    children: React.ReactNode;
}

const PageWrapper = ({ children }: PageWrapperProps) => {
    const shouldReduceMotion = useReducedMotion();
    const { isSameLayout } = useLayoutDetection();

    const pageVariants = useMemo(() =>
        createPageVariants({ reducedMotion: shouldReduceMotion || false, isSameLayout }),
        [shouldReduceMotion, isSameLayout]
    );

    const contentVariants = useMemo(() =>
        createContentVariants(isSameLayout),
        [isSameLayout]
    );

    return(
        <motion.div
            initial="initial"
            animate="enter"
            exit="exit"
            variants={pageVariants}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                willChange: 'transform, opacity',
                transformStyle: 'flat',
                perspective: 'none',
                transform: 'translateZ(0)',
                isolation: 'isolate',
                backfaceVisibility: 'hidden',
            }}
        >
            <PageOverlay isSameLayout={isSameLayout} />

        <motion.div
                variants={contentVariants}
                initial="initial"
                animate="animate"
                style={{
                    position: 'relative',
                    width: '100%',
            height: '100%',
                    zIndex: 1,
                    borderRadius: 'inherit',
            overflow: typeof window !== 'undefined' && window.innerWidth > 768 ? 'auto' : 'visible',
                }}
            >
                {children}
            </motion.div>

            <ShineEffect isSameLayout={isSameLayout} />
        </motion.div>
    );
};

export default PageWrapper;
