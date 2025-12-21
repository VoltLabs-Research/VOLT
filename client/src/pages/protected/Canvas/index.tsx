import React, { useEffect, useRef, useMemo } from 'react';
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
import useAnalysisConfigStore from '@/stores/analysis-config';
import useTeamJobs from '@/hooks/jobs/use-team-jobs';
import JobsHistoryViewer from '@/components/organisms/common/JobsHistoryViewer';
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

    // Subscribe to team jobs for real-time updates
    useTeamJobs();

    // Get trajectory data and current timestep from coordinator
    const { trajectory, currentTimestep } = useCanvasCoordinator({ trajectoryId });
    const { canvasUsers } = useCanvasPresence({ trajectoryId, enabled: !!trajectoryId });

    // Simple individual store subscriptions
    const isModelLoading = useModelStore((s) => s.isModelLoading);
    const activeScene = useModelStore((s) => s.activeScene);
    const reset = useModelStore((s) => s.reset);
    const didPreload = usePlaybackStore((s) => s.didPreload ?? false);
    const isPlaying = usePlaybackStore((s) => s.isPlaying);
    const showCanvasGrid = useEditorUIStore((s) => s.showCanvasGrid);
    const analysisConfigId = useAnalysisConfigStore((s) => s.analysisConfig?._id);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            reset();
            usePlaybackStore.getState().reset();
            useModelStore.getState().reset();
        };
    }, [reset]);

    // Memoize loading state calculation
    const showLoading = useMemo(() =>
        (isModelLoading && !(didPreload && isPlaying)) || !trajectory || currentTimestep === undefined,
        [isModelLoading, didPreload, isPlaying, trajectory, currentTimestep]
    );

    return (
        <Container className='w-max vh-max p-relative u-select-none editor-container'>
            <AnimatePresence>
                <PreloadingOverlay key="preloading-overlay" />

                {showLoading && (
                    <Container key="model-loading" className='d-flex flex-center w-max h-max p-absolute model-loading-container'>
                        <Loader scale={0.7} />
                    </Container>
                )}
            </AnimatePresence>

            <CanvasWidgets trajectory={trajectory} currentTimestep={currentTimestep} scene3DRef={scene3DRef} />
            <CanvasPresenceAvatars users={canvasUsers} />

            <Container className='canvas-jobs-panel p-absolute'>
                <JobsHistoryViewer trajectoryId={trajectoryId} showHeader={false} />
            </Container>

            <Scene3D ref={scene3DRef} showCanvasGrid={showCanvasGrid}>
                {/* Pass ALL required props to TimestepViewer - URL is computed inside */}
                <TimestepViewer
                    trajectoryId={trajectory?._id || ''}
                    currentTimestep={currentTimestep}
                    analysisId={analysisConfigId || 'default'}
                    activeScene={activeScene as any}
                    scale={CANVAS_CONFIG.timestepViewerDefaults.scale}
                    rotation={CANVAS_CONFIG.timestepViewerDefaults.rotation}
                    position={CANVAS_CONFIG.timestepViewerDefaults.position}
                />
            </Scene3D>
        </Container>
    );
};

export default React.memo(EditorPage);
