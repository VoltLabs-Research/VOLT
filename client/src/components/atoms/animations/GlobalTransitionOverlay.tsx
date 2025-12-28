import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { getLayoutKey, detectSameLayout } from '@/utilities/common/layout';
import { BALANCED_EASING } from '@/utilities/animations/animation';

const GlobalTransitionOverlay = () => {
    const location = useLocation();
    const currentLayoutKey = getLayoutKey(location.pathname);
    const isSameLayout = useMemo(() =>
        detectSameLayout(currentLayoutKey, 'globalPreviousLayoutKey'),
        [currentLayoutKey]
    );

    if(isSameLayout) return null;

    return(
        <motion.div
            key={location.key}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 0, transition: { duration: 0.22, ease: BALANCED_EASING } }}
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'var(--color-bg)',
                pointerEvents: 'none',
                zIndex: 1000,
            }}
        />
    );
};

export default GlobalTransitionOverlay;
