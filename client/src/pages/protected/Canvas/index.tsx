import React, { useEffect, useRef, useMemo } from 'react';
import { usePageTitle } from '@/hooks/core/use-page-title';
import Scene3D, { type Scene3DRef } from '@/components/organisms/scene/Scene3D';
import { useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import TimestepViewer from '@/components/organisms/scene/TimestepViewer';
import useCanvasCoordinator from '@/hooks/canvas/use-canvas-coordinator';
import useCanvasPresence from '@/hooks/canvas/use-canvas-presence';
import useRequireTrajectory from '@/features/trajectory/hooks/use-require-trajectory';
import useKeyboardShortcuts from '@/hooks/ui/use-keyboard-shortcuts';
import CanvasWidgets from '@/components/atoms/scene/CanvasWidgets';
import CanvasPresenceAvatars from '@/components/atoms/scene/CanvasPresenceAvatars';
import PreloadingOverlay from '@/components/atoms/common/PreloadingOverlay';
import KeyboardShortcutsPanel from '@/components/organisms/common/KeyboardShortcutsPanel';
import ShortcutFeedback from '@/components/atoms/common/ShortcutFeedback';
import { useEditorStore } from '@/stores/slices/editor';
import { useAnalysisConfigStore } from '@/stores/slices/analysis';
import { useKeyboardShortcutsStore } from '@/stores/slices/ui/keyboard-shortcuts-slice';
import JobsHistoryViewer from '@/components/organisms/common/JobsHistoryViewer';
import Loader from '@/components/atoms/common/Loader';
import Container from '@/components/primitives/Container';
import ExposureSettingsWidget from '@/components/molecules/scene/ExposureSettingsWidget';
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
    const analysisConfigId = useAnalysisConfigStore((s) => s.analysisConfig?._id);

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

            <CanvasWidgets trajectory={trajectory} currentTimestep={currentTimestep} scene3DRef={scene3DRef} />
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

