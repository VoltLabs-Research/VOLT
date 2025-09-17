import React, { useState, useMemo } from 'react';
import type { ModelRailProps } from '@/types/raster';
import { AnimatePresence, motion } from 'framer-motion';
import ModelRailItem from '../ModelRailItem';

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
            <ModelRailItem
                scene={selectedThumb}
                isSelected={true}
                onClick={onModelChange}
            />

            <AnimatePresence>
                {railOpen && restThumbs.map((scene) => (
                    <ModelRailItem
                        key={`opt-${scene.frame}-${scene.model}`}
                        scene={scene}
                        isSelected={false}
                        onClick={onModelChange}
                    />
                ))}
            </AnimatePresence>
        </motion.div>
    );
};

export default ModelRail;