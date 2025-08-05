import { motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { getLayoutKey, detectSameLayout } from '@/utilities/layout';
import { PREMIUM_EASING, BALANCED_EASING } from '@/utilities/animation';

const GlobalTransitionOverlay = () => {
    const location = useLocation();
    const currentLayoutKey = getLayoutKey(location.pathname);
    const isSameLayout = useMemo(() => 
        detectSameLayout(currentLayoutKey, 'globalPreviousLayoutKey'), 
        [currentLayoutKey]
    );

    if(isSameLayout) return null;

    return (
        <motion.div
            initial={{ opacity: 1, scale: 1.008 }}
            animate={{ 
                opacity: 0, 
                scale: 1,
                transition: {
                    duration: 0.8,
                    ease: BALANCED_EASING,
                    opacity: { duration: 0.9, ease: BALANCED_EASING },
                    scale: { duration: 0.7, ease: BALANCED_EASING },
                }
            }}
            exit={{ 
                opacity: 1, 
                scale: 0.992,
                transition: {
                    duration: 0.5,
                    ease: PREMIUM_EASING,
                    opacity: { duration: 0.4 },
                    scale: { duration: 0.5 },
                }
            }}
            style={{
                position: 'fixed',
                inset: 0,
                background: `
                    radial-gradient(ellipse at top, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,1) 100%),
                    linear-gradient(135deg, rgba(240,240,255,0.1) 0%, rgba(255,240,240,0.1) 100%)
                `,
                backdropFilter: 'blur(12px) saturate(1.1)',
                pointerEvents: 'none',
                zIndex: 1000,
                mixBlendMode: 'overlay',
            }}
        />
    );
};

export default GlobalTransitionOverlay;