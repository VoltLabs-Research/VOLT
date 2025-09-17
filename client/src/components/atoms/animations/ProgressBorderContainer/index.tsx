import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import './ProgressBorderContainer.css';

interface ProgressBorderContainerProps {
  children: React.ReactNode;
  hasJobs: boolean;
  shouldHideBorder: boolean;
  isAnimating?: boolean;
  className?: string;
}

const ProgressBorderContainer: React.FC<ProgressBorderContainerProps> = ({
    children,
    hasJobs,
    shouldHideBorder,
    isAnimating = false,
    className = ''
}) => {
    const showBorder = hasJobs && !shouldHideBorder;

    return (
        <div className='progress-border-container'>
            {showBorder && (
                <motion.div 
                    className="border-animation"
                    initial={{ opacity: 0 }}
                    animate={{ 
                        opacity: 1,
                        rotate: 360
                    }}
                    transition={{ 
                        opacity: { duration: 0.3 },
                        rotate: { 
                            repeat: Infinity, 
                            duration: 4, 
                            ease: "linear" 
                        }
                    }}
                />
            )}
            <div className="container-content">
                {children}
            </div>
        </div>
    );
};

export default React.memo(ProgressBorderContainer);