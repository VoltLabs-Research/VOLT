import React, { useState, useMemo } from 'react';
import type { ModelRailProps } from '@/types/raster';
import { AnimatePresence, motion } from 'framer-motion';
import ModelRailItem from '../ModelRailItem';

const ModelRail: React.FC<ModelRailProps> = ({ modelsForCurrentFrame, selectedModel, onModelChange }) => {
    const [railOpen, setRailOpen] = useState(false);

    // Protección adicional: si no hay modelos, no mostrar nada
    if (!modelsForCurrentFrame || modelsForCurrentFrame.length === 0) {
        console.log('No models available for ModelRail');
        return null;
    }

    const { selectedThumb, restThumbs } = useMemo(() => {
        // Asegurarnos de que hay al menos un modelo disponible
        if (modelsForCurrentFrame.length === 0) {
            return { selectedThumb: null, restThumbs: [] };
        }
        
        // Buscar el modelo seleccionado o usar el primero como fallback
        const selected = modelsForCurrentFrame.find(scene => scene.model === selectedModel) || modelsForCurrentFrame[0];
        const rest = modelsForCurrentFrame.filter(scene => scene.model !== selected?.model);
        
        return { selectedThumb: selected, restThumbs: rest };
    }, [modelsForCurrentFrame, selectedModel]);

    // Si no hay un modelo seleccionado, no mostrar nada
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