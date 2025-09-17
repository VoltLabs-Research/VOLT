import React from 'react';
import { motion } from 'framer-motion';
import { GoPlus } from 'react-icons/go';
import { IoCloseOutline } from 'react-icons/io5';

const ToggleOption: React.FC<any> = ({ className, label, isVisible, onToggle }) => {

    return (
        <motion.button
            type='button'
            onClick={onToggle}
            className={className}
            aria-pressed={isVisible}
            initial={false}
            animate={{
                backgroundColor: isVisible ? "#161616" : "#0d0d0d",
                boxShadow: isVisible
                    ? "0 0 0 1px rgba(99,102,241,.45), 0 10px 30px rgba(0,0,0,.35)"
                    : "0 0 0 rgba(0,0,0,0)"
            }}
            transition={{
                duration: 4.2,
                ease: 'easeInOut',
                repeat: Infinity
            }}
            whileHover={{
                scale: 1.02,
                boxShadow: "0 0 0 1px rgba(99,102,241,.35), 0 10px 30px rgba(0,0,0,.35)"
            }}
        >
            <motion.span
                className='metric-aurora'
                aria-hidden
                animate={{
                    rotate: [0, -10, 6, 0],
                    opacity: [0.16, 0.32, 0.22, 0.16],
                    scale: [1, 1.04, 1.01, 1]
                }}
                transition={{
                    duration: 7.2,
                    ease: 'easeInOut',
                    repeat: Infinity
                }}
            />
            <span className='raster-metric-label'>{label}</span>

            <b className='raster-metric-value'>
                <i className='raster-metric-icon'>
                    {isVisible ? <IoCloseOutline size={18} /> : <GoPlus size={18} />}
                </i>
            </b>
        </motion.button>
    );
};

export default ToggleOption;