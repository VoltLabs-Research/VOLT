import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface CollapsibleJobContentProps {
    id: string;
    isExpanded: boolean;
    className?: string;
    duration?: number;
    ease?: 'easeInOut';
    children: ReactNode;
}

const CollapsibleJobContent = ({
    id,
    isExpanded,
    className,
    duration = 0.2,
    ease,
    children
}: CollapsibleJobContentProps) => {
    const prefersReducedMotion = usePrefersReducedMotion();

    if (prefersReducedMotion) {
        return isExpanded ? <div id={id} className={className}>{children}</div> : null;
    }

    return (
        <AnimatePresence>
            {isExpanded && (
                <motion.div
                    id={id}
                    className={className}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration, ...(ease ? { ease } : {}) }}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default CollapsibleJobContent;
