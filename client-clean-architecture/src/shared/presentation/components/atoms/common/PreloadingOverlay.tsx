import React from 'react';
import { motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import TetrahedronLoader from '@/modules/canvas/presentation/components/atoms/TetrahedronLoader';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import Container from '@/shared/presentation/components/primitives/Container';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';
import Title from '@/shared/presentation/components/primitives/Title';

// TODO: move to scene/
const PreloadingOverlay: React.FC = () => {
    const isPreloading = useEditorStore((state: any) => state.isPreloading ?? false);
    const preloadProgress = useEditorStore((state: any) => state.preloadProgress ?? 0);

    if (!isPreloading) return null;

    const ringVars = {
        ['--p' as any]: preloadProgress,
        ['--stroke' as any]: '1px'
    };

    return (
        <motion.div
            className="d-flex flex-center editor-model-loading-wrapper p-absolute w-max h-max"
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
