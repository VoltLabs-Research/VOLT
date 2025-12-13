import React, { useMemo, useRef, useState } from 'react';
import Draggable from '@/components/atoms/common/Draggable';
import WindowIcons from '@/components/molecules/common/WindowIcons';
import { motion } from 'framer-motion';
import './DraggableBinaryContainer.css';

interface DraggableBinaryContainerProps{
    onClose?: () => void;
    handleSubmit?: (data: any) => void;
    children: any,
    bg: any;
    title: string;
    description: string;
    isRequired?: boolean;
}

const DraggableBinaryContainer: React.FC<DraggableBinaryContainerProps> = ({ title, handleSubmit, description, onClose, bg, children, isRequired = false }) => {
    const [showRequiredMessage, setShowRequiredMessage] = useState(false);

    // Use useMemo to calculate center position only once
    const initialPos = useMemo(() => {
        const containerWidth = 1000; // Match CSS width
        const containerHeight = 600; // Match CSS height
        const centerX = (window.innerWidth / 2) - (containerWidth / 2);
        const centerY = (window.innerHeight / 2) - (containerHeight / 2);
        return { x: Math.max(0, centerX), y: Math.max(0, centerY) };
    }, []);

    const containerRef = useRef<HTMLDivElement>(null);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if(isRequired){
            setShowRequiredMessage(true);
            setTimeout(() => setShowRequiredMessage(false), 3000);
            return;
        }
        onClose?.();
    };

    return(
        <>
            <motion.div
                initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
                exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                className='draggable-blur-overlay'
                onClick={handleBackdropClick}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'var(--color-overlay)',
                    zIndex: 9999,
                    cursor: isRequired ? 'not-allowed' : 'pointer',
                    pointerEvents: isRequired ? 'none' : 'auto',
                }}
            />
            <Draggable
                className='team-creator-container primary-surface'
                initial={initialPos}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    zIndex: 10000,
                    pointerEvents: 'auto',
                }}
            >
                <WindowIcons
                    onClose={isRequired ? () => {
                        setShowRequiredMessage(true);
                        setTimeout(() => setShowRequiredMessage(false), 3000);
                    } : onClose}
                    withBackground />

                {showRequiredMessage && isRequired && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        style={{
                            position: 'absolute',
                            top: '20px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(255, 68, 68, 0.9)',
                            color: 'white',
                            padding: '12px 20px',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 500,
                            zIndex: 10001,
                            whiteSpace: 'nowrap'
                        }}
                    >
                        You must create a team to continue
                    </motion.div>
                )}

                <div className='team-creator-left-container'>
                    <img src={bg} className='team-creator-background' />
                </div>

                <div className='team-creator-right-container'>
                    <div className='team-creator-header-container'>
                        <h3 className='team-creator-title'>{title}</h3>
                        <p className='team-creator-description'>{description}</p>
                    </div>

                    <form onSubmit={handleSubmit} className='team-creator-body-container'>
                        {children}
                    </form>
                </div>
            </Draggable>
        </>
    );
};

export default DraggableBinaryContainer;
