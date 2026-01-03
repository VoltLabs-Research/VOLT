import React from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
    children: React.ReactNode;
}

const pageVariants = {
    initial: {
        opacity: 0,
        scale: 0.98, // Slightly more subtle scale
        y: 10,
        filter: 'blur(8px)' // Reduce blur slightly for performance
    },
    enter: {
        opacity: 1,
        scale: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: {
            duration: 0.5,
            ease: [0.32, 0.72, 0, 1] as any, // "Fluid" Apple-like bezier
            staggerChildren: 0.1
        }
    },
    exit: {
        opacity: 0,
        scale: 1.02,
        filter: 'blur(4px)',
        transition: {
            duration: 0.3,
            ease: [0.32, 0.72, 0, 1] as any
        }
    }
};

const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
    return (
        <motion.div
            initial="initial"
            animate="enter"
            exit="exit"
            variants={pageVariants}
            style={{
                width: '100%',
                height: '100%',
                position: 'relative'
            }}
        >
            {children}
        </motion.div>
    );
};

export default PageTransition;
