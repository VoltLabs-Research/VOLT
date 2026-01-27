import React, { useEffect, useRef, useMemo } from 'react';
import { usePageTitle } from '@/shared/presentation/hooks/core/use-page-title';
import Scene3D, { type Scene3DRef } from '@/modules/canvas/presentation/components/organisms/Scene3D';
import { useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import TimestepViewer from '@/modules/canvas/presentation/components/organisms/TimestepViewer';
import useCanvasCoordinator from '@/modules/canvas/presentation/hooks/use-canvas-coordinator';
import useCanvasPresence from '@/modules/canvas/presentation/hooks/use-canvas-presence';
import useRequireTrajectory from '@/modules/trajectory/presentation/hooks/use-require-trajectory';
import useKeyboardShortcuts from '@/shared/presentation/hooks/ui/use-keyboard-shortcuts';
import CanvasWidgets from '@/modules/canvas/presentation/components/atoms/CanvasWidgets';
import CanvasPresenceAvatars from '@/modules/canvas/presentation/components/atoms/CanvasPresenceAvatars';
import PreloadingOverlay from '@/shared/presentation/components/atoms/common/PreloadingOverlay';
import KeyboardShortcutsPanel from '@/shared/presentation/components/organisms/common/KeyboardShortcutsPanel';
import ShortcutFeedback from '@/shared/presentation/components/atoms/common/ShortcutFeedback';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import { useAnalysisStore } from '@/modules/analysis/presentation/stores';
import { useKeyboardShortcutsStore } from '@/shared/presentation/stores/slices/ui/keyboard-shortcuts-slice';
import JobsHistoryViewer from '@/modules/jobs/presentation/components/organisms/JobsHistoryViewer';
import Loader from '@/shared/presentation/components/atoms/common/Loader';
import Container from '@/shared/presentation/components/primitives/Container';
import ExposureSettingsWidget from '@/modules/canvas/presentation/components/molecules/ExposureSettingsWidget';
import '@/modules/canvas/presentation/pages/protected/Canvas/Canvas.css';

const CANVAS_CONFIG = {
    autoSaveDelay: 2000,
    timestepViewerDefaults: {
        scale: 1,
        rotation: { x: 0, y: 0, z: 0 },
        position: { x: 0, y: 0, z: 0 }
    }
} as const;

const EditorPage: React.FC = () => {
    usePageTitle('Canvas');
    const { trajectoryId: rawTrajectoryId } = useParams<{ trajectoryId?: string }>();
    const scene3DRef = useRef<Scene3DRef>(null);
    const trajectoryId = rawTrajectoryId ?? '';

    useKeyboardShortcuts();
    const setCurrentScope = useKeyboardShortcutsStore((s) => s.setCurrentScope);

    // Set canvas scope when entering the page
    useEffect(() => {
        setCurrentScope('canvas');
        return () => setCurrentScope('global');
    }, [setCurrentScope]);

    // Ensure the trajectory is loaded
    const { trajectory: loadedTrajectory, isLoading: trajectoryLoading, isReady: trajectoryReady } = useRequireTrajectory({
        trajectoryId,
        enabled: !!trajectoryId
    });

    // Get trajectory data and current timestep from coordinator
    const { trajectory, currentTimestep } = useCanvasCoordinator({ trajectoryId });
    const { canvasUsers } = useCanvasPresence({ trajectoryId, enabled: !!trajectoryId });

    // Simple individual store subscriptions
    const isModelLoading = useEditorStore((s) => s.isModelLoading);
    const resetModel = useEditorStore((s) => s.resetModel);
    const didPreload = useEditorStore((s) => s.didPreload ?? false);
    const isPlaying = useEditorStore((s) => s.isPlaying);
    const showCanvasGrid = useEditorStore((s) => s.grid.enabled);
    const analysisConfigId = useAnalysisStore((s) => s.analysisConfig?._id);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            useEditorStore.getState().resetModel();
            useEditorStore.getState().resetPlayback();
        };
    }, []);

    // Memoize loading state calculation
    const showLoading = useMemo(() =>
        (isModelLoading && !(didPreload && isPlaying)) || !trajectory || currentTimestep === undefined || trajectoryLoading,
        [isModelLoading, didPreload, isPlaying, trajectory, currentTimestep, trajectoryLoading]
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

            {trajectory && currentTimestep !== undefined && (
                <CanvasWidgets trajectory={trajectory as any} currentTimestep={currentTimestep} scene3DRef={scene3DRef} />
            )}
            <CanvasPresenceAvatars users={canvasUsers} />

            <Container className='canvas-jobs-panel p-absolute'>
                <JobsHistoryViewer trajectoryId={trajectoryId} showHeader={false} queueFilter="analysis" />
            </Container>

            <Scene3D ref={scene3DRef} showCanvasGrid={showCanvasGrid}>
                <TimestepViewer
                    trajectoryId={trajectory?._id || ''}
                    currentTimestep={currentTimestep}
                    analysisId={analysisConfigId || 'default'}

                    scale={CANVAS_CONFIG.timestepViewerDefaults.scale}
                    rotation={CANVAS_CONFIG.timestepViewerDefaults.rotation}
                    position={CANVAS_CONFIG.timestepViewerDefaults.position}
                />
            </Scene3D>

            {/* Keyboard Shortcuts UI */}
            <KeyboardShortcutsPanel />
            <ShortcutFeedback />

            {/* Scene Settings Widget */}
            <ExposureSettingsWidget />
        </Container>
    );
};

export default React.memo(EditorPage);

