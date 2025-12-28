import { motion } from 'framer-motion';
import { createOverlayVariants } from '@/utilities/animations/animation';

interface PageOverlayProps {
    isSameLayout: boolean;
}

const PageOverlay = ({ isSameLayout }: PageOverlayProps) => {
    if(isSameLayout) return null;

    const overlayVariants = createOverlayVariants(isSameLayout);

    return(
        <motion.div
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 0,
                borderRadius: 'inherit',
                background: 'var(--color-bg)',
            }}
        />
    );
};

export default PageOverlay;
