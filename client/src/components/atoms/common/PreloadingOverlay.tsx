import React from 'react';
import { motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import TetrahedronLoader from './TetrahedronLoader';
import usePlaybackStore from '@/stores/editor/playback';
import Container from '@/components/primitives/Container';
import Paragraph from '@/components/primitives/Paragraph';
import Title from '@/components/primitives/Title';

// TODO: move to scene/
const PreloadingOverlay: React.FC = () => {
    const isPreloading = usePlaybackStore((state) => state.isPreloading ?? false);
    const preloadProgress = usePlaybackStore((state) => state.preloadProgress ?? 0);

    if (!isPreloading) return null;

    const ringVars = {
        ['--p' as any]: preloadProgress,
        ['--stroke' as any]: '1px'
    };

    return (
        <motion.div
            className="editor-model-loading-wrapper"
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
            <Container className="w-max text-center p-relative overflow-hidden d-flex column gap-3 editor-model-loading-container" style={ringVars}>
                <Canvas>
                    <TetrahedronLoader />
                </Canvas>
                <Container className="d-flex column gap-2">
                    <Title className="font-size-5-5 font-weight-6 editor-model-loading-title">Setting up your scene...</Title>
                    <Paragraph className="font-weight-4 font-size-4 line-height-5 editor-model-loading-description">
                        For quick analysis and visualizations you may prefer to rasterize your simulation.
                    </Paragraph>
                </Container>
            </Container>
        </motion.div>
    );
};

export default React.memo(PreloadingOverlay);
