import React, { useEffect, useRef, useMemo, useState } from 'react';
import Scene3D, { type Scene3DRef } from '@/components/organisms/scene/Scene3D';
import { useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import TimestepViewer from '@/components/organisms/scene/TimestepViewer';
import useCanvasCoordinator from '@/hooks/canvas/use-canvas-coordinator';
import useCanvasPresence from '@/hooks/canvas/use-canvas-presence';
import CanvasWidgets from '@/components/atoms/scene/CanvasWidgets';
import CanvasPresenceAvatars from '@/components/atoms/scene/CanvasPresenceAvatars';
import PreloadingOverlay from '@/components/atoms/common/PreloadingOverlay';
import useEditorUIStore from '@/stores/ui/editor';
import useModelStore from '@/stores/editor/model';
import usePlaybackStore from '@/stores/editor/playback';
import Loader from '@/components/atoms/common/Loader';
import Container from '@/components/primitives/Container';
import './Canvas.css';

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
    const { canvasUsers } = useCanvasPresence({ trajectoryId, enabled: !!trajectoryId });
    const isModelLoading = useModelStore((state) => state.isModelLoading);
    const didPreload = usePlaybackStore((state) => state.didPreload ?? false);
    const isPlaying = usePlaybackStore((state) => state.isPlaying);
    const showCanvasGrid = useEditorUIStore((state) => state.showCanvasGrid);
    const reset = useModelStore((state) => state.reset);

    useEffect(() => {
        return() => {
            reset();
            usePlaybackStore.getState().reset();
            useModelStore.getState().reset();
        };
    }, [reset]);

    return(
        <Container className='w-max vh-max p-relative u-select-none editor-container'>
            <AnimatePresence>
                <PreloadingOverlay />

                {((isModelLoading && !(didPreload && isPlaying)) || (!trajectory || currentTimestep === undefined)) && (
                    <Container className='d-flex flex-center w-max h-max p-absolute model-loading-container'>
                        <Loader scale={0.7} />
                    </Container>
                )}
            </AnimatePresence>

            <CanvasWidgets trajectory={trajectory} currentTimestep={currentTimestep} scene3DRef={scene3DRef} />
            <CanvasPresenceAvatars users={canvasUsers} />

            <Scene3D ref={scene3DRef} showCanvasGrid={showCanvasGrid}>
                <TimestepViewer
                    scale={CANVAS_CONFIG.timestepViewerDefaults.scale}
                    rotation={CANVAS_CONFIG.timestepViewerDefaults.rotation}
                    position={CANVAS_CONFIG.timestepViewerDefaults.position}
                />
            </Scene3D>
        </Container>
    );
};

export default React.memo(EditorPage);
