import { motion } from 'framer-motion';
import { BALANCED_EASING } from '@/utilities/animation';

interface ShineEffectProps {
    isSameLayout: boolean;
}

const ShineEffect = ({ isSameLayout }: ShineEffectProps) => {
    if(isSameLayout) return null;

    return(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.18, 0] }}
            transition={{
                duration: 1.4,
                ease: BALANCED_EASING,
                delay: 0.3,
            }}
            style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(45deg, transparent 48%, rgba(255,255,255,0.1) 50%, transparent 52%)',
                pointerEvents: 'none',
                zIndex: 2,
                borderRadius: 'inherit',
            }}
        />
    );
};

export default ShineEffect;
