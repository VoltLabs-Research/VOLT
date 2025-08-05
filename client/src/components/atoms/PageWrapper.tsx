import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { createPageVariants, createContentVariants } from '@/utilities/animation';
import useLayoutDetection from '@/hooks/ui/useLayoutDetection';
import PageOverlay from '@/components/atoms/PageOverlay';
import ShineEffect from '@/components/atoms/ShineEffect';

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

    return (
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
                willChange: 'transform, opacity, filter',
                transformStyle: isSameLayout ? 'flat' : 'preserve-3d',
                perspective: isSameLayout ? 'none' : '1200px',
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
                    overflow: 'auto',
                }}
            >
                {children}
            </motion.div>

            <ShineEffect isSameLayout={isSameLayout} />
        </motion.div>
    );
};

export default PageWrapper;