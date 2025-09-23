import { motion } from 'framer-motion';
import { createOverlayVariants } from '@/utilities/animation';

interface PageOverlayProps {
    isSameLayout: boolean;
}

const PageOverlay = ({ isSameLayout }: PageOverlayProps) => {
    if(isSameLayout) return null;

    const overlayVariants = createOverlayVariants(isSameLayout);

    return (
        <motion.div
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: -1,
                borderRadius: 'inherit',
                backgroundColor: '#000',
            }}
        />
    );
};

export default PageOverlay;
