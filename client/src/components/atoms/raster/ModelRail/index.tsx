import React, { useState, useMemo } from 'react';
import type { ModelRailProps } from '@/types/raster';
import { AnimatePresence, motion } from 'framer-motion';

const ModelRail: React.FC<ModelRailProps> = ({ modelsForCurrentFrame, selectedModel, onModelChange }) => {
    const [railOpen, setRailOpen] = useState(false);


    const { selectedThumb, restThumbs } = useMemo(() => {
        const selected = modelsForCurrentFrame.find(scene => scene.model === selectedModel) || modelsForCurrentFrame[0];
        const rest = modelsForCurrentFrame.filter(scene => scene.model !== selected?.model);
        return { selectedThumb: selected, restThumbs: rest };
    }, [modelsForCurrentFrame, selectedModel]);


    if(!selectedThumb) return null;

    return (
        <motion.div
            className='raster-rail-container'
            style={{ width: 132 }}
            onMouseEnter={() => setRailOpen(true)}
            onMouseLeave={() => setRailOpen(false)}
            initial={false}
            transition={{ duration: 0.2 }}
        >
            <motion.img
                key={`sel-${selectedThumb.frame}-${selectedThumb.model}`}
                className='raster-analysis-scene selected'
                src={selectedThumb.data}
                alt={`${selectedThumb.model} - Frame ${selectedThumb.frame}`}
                title={selectedThumb.model}
                onClick={() => onModelChange(selectedThumb.model)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                transition={{
                    type: 'spring',
                    stiffness: 320,
                    damping: 26
                }}
                style={{
                    width: '100%',
                    height: 84,
                    objectFit: 'cover',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--accent)',
                    cursor: 'pointer',
                    flexShrink: 0  
                }}
            />

            <AnimatePresence>
                {railOpen && restThumbs.map((scene) => (
                    <motion.img
                        key={`opt-${scene.frame}-${scene.model}`}
                        className='raster-analysis-scene'
                        src={scene.data}
                        alt={`${scene.model} - Frame ${scene.frame}`}
                        title={scene.model}
                        onClick={() => onModelChange(scene.model)}
                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                        animate={{ opacity: 1, height: 84, scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                        transition={{ duration: 0.18 }}
                        style={{
                            width: '100%',
                            objectFit: 'cover',
                            borderRadius: '0.75rem',
                            cursor: 'pointer',
                            overflow: 'hidden'
                        }}
                    />
                ))}
            </AnimatePresence>
        </motion.div>
    );
};

export default ModelRail;