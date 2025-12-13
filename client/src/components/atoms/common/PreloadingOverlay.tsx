import React from 'react';
import { motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import TetrahedronLoader from './TetrahedronLoader';
import usePlaybackStore from '@/stores/editor/playback';

const PreloadingOverlay: React.FC = () => {
    const isPreloading = usePlaybackStore((state) => state.isPreloading ?? false);
    const preloadProgress = usePlaybackStore((state) => state.preloadProgress ?? 0);

    if(!isPreloading) return null;

    const ringVars = {
        ['--p' as any]: preloadProgress,
        ['--stroke' as any]: '1px'
    };

    return(
        <motion.div
            className="editor-model-loading-wrapper"
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
            <div className="editor-model-loading-container" style={ringVars}>
                <Canvas>
                    <TetrahedronLoader />
                </Canvas>
                <div className="editor-model-loading-body-container">
                    <h3 className="editor-model-loading-title">Setting up your scene...</h3>
                    <p className="editor-model-loading-description">
                        For quick analysis and visualizations you may prefer to rasterize your simulation.
                    </p>
                </div>
            </div>
        </motion.div>
    );
};

export default React.memo(PreloadingOverlay);
