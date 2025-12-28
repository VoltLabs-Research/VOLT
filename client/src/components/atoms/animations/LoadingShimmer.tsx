import { motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { getLayoutKey, detectSameLayout } from '@/utilities/common/layout';
import { BALANCED_EASING } from '@/utilities/animations/animation';

const LoadingShimmer = () => {
    const shouldReduceMotion = useReducedMotion();
    const location = useLocation();
    const currentLayoutKey = getLayoutKey(location.pathname);
    const isSameLayout = useMemo(() =>
        detectSameLayout(currentLayoutKey, 'shimmerPreviousLayoutKey'),
        [currentLayoutKey]
    );

    if(shouldReduceMotion) return null;

    return(
        <motion.div
            initial={{ x: '-100%', opacity: 0 }}
            animate={{
                x: '100%',
                opacity: isSameLayout ? 0.4 : 1,
                transition: {
                    x: {
                        duration: isSameLayout ? 1.2 : 1.8,
                        ease: 'linear',
                        repeat: Infinity,
                        repeatDelay: isSameLayout ? 1.0 : 0.7,
                    },
                    opacity: {
                        duration: isSameLayout ? 0.4 : 0.6,
                        ease: BALANCED_EASING,
                        delay: 0.15,
                    },
                }
            }}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: isSameLayout ? '1px' : '2px',
                background: `linear-gradient(90deg, transparent, rgba(59, 130, 246, ${isSameLayout ? '0.25' : '0.45'}), transparent)`,
                pointerEvents: 'none',
                zIndex: 999,
            }}
        />
    );
};

export default LoadingShimmer;
