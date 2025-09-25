import React, { useEffect, useRef } from 'react';
import Scene3D, { type Scene3DRef } from '@/components/organisms/Scene3D';
import { Canvas } from '@react-three/fiber';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import TimestepViewer from '@/components/organisms/TimestepViewer';
import useCanvasCoordinator from '@/hooks/canvas/use-canvas-coordinator';
import CanvasWidgets from '@/components/atoms/CanvasWidgets';
import TetrahedronLoader from '@/components/atoms/TetrahedronLoader';
import useEditorUIStore from '@/stores/ui/editor';
import useModelStore from '@/stores/editor/model';
import usePlaybackStore from '@/stores/editor/playback';
// import useAuthStore from '@/stores/authentication';
import './Canvas.css';
import Loader from '@/components/atoms/Loader';

const CANVAS_CONFIG = {
    autoSaveDelay: 2000,
    timestepViewerDefaults: {
        scale: 1,
        rotation: { x: 0, y: 0, z: 0 },
        position: { x: 0, y: 0, z: 0 }
    }
} as const;

const EditorPage: React.FC = () => {
    const { trajectoryId: rawTrajectoryId } = useParams<{ trajectoryId?: string }>();
    const scene3DRef = useRef<Scene3DRef>(null);
    const trajectoryId = rawTrajectoryId ?? '';
    const { trajectory, currentTimestep } = useCanvasCoordinator({ trajectoryId });
    const isModelLoading = useModelStore((state) => state.isModelLoading);
    const isPreloading = usePlaybackStore((state) => state.isPreloading ?? false);
    const preloadProgress = usePlaybackStore((state) => state.preloadProgress ?? 0);
    const showCanvasGrid = useEditorUIStore((state) => state.showCanvasGrid);
    const didPreload = usePlaybackStore((state) => state.didPreload ?? false);
    const reset = useModelStore((state) => state.reset);

    useEffect(() => {
        return () => {
            reset();
        };
    }, []);

    // Removed animated speed indicator (unused in UI)

    const ringVars = {
        ['--p' as any]: isPreloading ? preloadProgress : 0,
        ['--stroke' as any]: '1px'
    };

    return (
        <div className="editor-container">
            <AnimatePresence>
                {isPreloading && (
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
                )}

                {((isModelLoading) || (!trajectory || currentTimestep === undefined)) && (
                    <div className='model-loading-container'>
                        <Loader scale={0.7} />
                    </div>
                )}
            </AnimatePresence>

            <CanvasWidgets trajectory={trajectory} currentTimestep={currentTimestep} />
            <Scene3D ref={scene3DRef} showCanvasGrid={showCanvasGrid}>
                <TimestepViewer
                    scale={CANVAS_CONFIG.timestepViewerDefaults.scale}
                    rotation={CANVAS_CONFIG.timestepViewerDefaults.rotation}
                    position={CANVAS_CONFIG.timestepViewerDefaults.position}
                />
            </Scene3D>
        </div>
    );
};

export default EditorPage;
