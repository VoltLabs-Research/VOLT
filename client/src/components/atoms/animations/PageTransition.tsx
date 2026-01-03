import React from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
    children: React.ReactNode;
}

const pageVariants = {
    initial: {
        opacity: 0,
        scale: 0.99,
        y: 10, // Slight offset from bottom
        filter: 'blur(10px)'
    },
    enter: {
        opacity: 1,
        scale: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: {
            duration: 0.4,
            ease: [0.2, 0.65, 0.3, 0.9] as any, // Custom cubic bezier for "Apple-like" feel
        }
    },
    exit: {
        opacity: 0,
        scale: 1.01, // Subtle expansion on exit
        filter: 'blur(10px)',
        transition: {
            duration: 0.3,
            ease: 'easeIn' as any
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
