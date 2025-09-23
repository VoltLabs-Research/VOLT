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
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0, transition: { duration: 0.28, ease: BALANCED_EASING } }}
            exit={{ opacity: 0.5, transition: { duration: 0.2, ease: BALANCED_EASING } }}
            style={{
                position: 'fixed',
                inset: 0,
                backdropFilter: 'blur(12px) saturate(1.1)',
                pointerEvents: 'none',
                zIndex: 1000,
                mixBlendMode: 'overlay',
            }}
        />
    );
};

export default GlobalTransitionOverlay;