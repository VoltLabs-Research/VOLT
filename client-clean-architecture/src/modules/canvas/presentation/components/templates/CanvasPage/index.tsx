import React, { useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import useKeyboardShortcuts from '@/shared/presentation/hooks/use-keyboard-shortcuts';
import { useKeyboardShortcutsStore } from '@/shared/presentation/stores/use-keyboard-shortcuts-store';
import Scene3D, { type Scene3DRef } from '@/modules/canvas/presentation/components/organisms/Scene3D';
import TimestepViewer from '@/modules/canvas/presentation/components/organisms/TimestepViewer';
import useCanvasCoordinator from '@/modules/canvas/presentation/hooks/use-canvas-coordinator';
import useCanvasPresence from '@/modules/canvas/presentation/hooks/use-canvas-presence';
import CanvasWidgets from '@/modules/canvas/presentation/components/atoms/CanvasWidgets';
import CanvasPresenceAvatars from '@/modules/canvas/presentation/components/atoms/CanvasPresenceAvatars';
import PreloadingOverlay from '@/modules/canvas/presentation/components/atoms/PreloadingOverlay';
import KeyboardShortcutsPanel from '@/shared/presentation/components/KeyboardShortcutsPanel';
import ShortcutFeedback from '@/shared/presentation/components/ShortcutFeedback';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import useAnalysisConfigStore from '@/modules/canvas/presentation/stores/use-analysis-config-store';
import Loader from '@/shared/presentation/components/Loader';
import Container from '@/shared/presentation/components/Container';
import ExposureSettingsWidget from '@/modules/canvas/presentation/components/molecules/ExposureSettingsWidget';
import JobsHistoryViewer from '@/modules/trajectory/presentation/components/organisms/JobsHistoryViewer';
import '@/modules/canvas/presentation/components/templates/CanvasPage/CanvasPage.css';

const CANVAS_CONFIG = {
    autoSaveDelay: 2000,
    timestepViewerDefaults: {
        scale: 1,
        rotation: { x: 0, y: 0, z: 0 },
        position: { x: 0, y: 0, z: 0 }
    }
} as const;

const CanvasPage: React.FC = () => {
    usePageTitle('Canvas');
    const { trajectoryId: rawTrajectoryId } = useParams<{ trajectoryId?: string }>();
    const scene3DRef = useRef<Scene3DRef>(null);
    const trajectoryId = rawTrajectoryId ?? '';

    const { trajectory, currentTimestep, isLoading: trajectoryLoading } = useCanvasCoordinator({ trajectoryId });
    const { canvasUsers } = useCanvasPresence({ trajectoryId, enabled: !!trajectoryId });

    useKeyboardShortcuts();
    const setCurrentScope = useKeyboardShortcutsStore((s) => s.setCurrentScope);

    useEffect(() => {
        setCurrentScope('canvas');
        return () => setCurrentScope('global');
    }, [setCurrentScope]);

    const isModelLoading = useEditorStore((s) => s.isModelLoading);
    const didPreload = useEditorStore((s) => s.didPreload ?? false);
    const isPlaying = useEditorStore((s) => s.isPlaying);
    const showCanvasGrid = useEditorStore((s) => s.grid.enabled);
    const analysisConfigId = useAnalysisConfigStore((s) => s.analysisConfig?._id);

    useEffect(() => {
        return () => {
            useEditorStore.getState().resetModel();
            useEditorStore.getState().resetPlayback();
        };
    }, []);

    const showLoading = useMemo(() =>
        (isModelLoading && !(didPreload && isPlaying)) || !trajectory || currentTimestep === undefined || trajectoryLoading,
        [isModelLoading, didPreload, isPlaying, trajectory, currentTimestep, trajectoryLoading]
    );

    return (
        <Container className='w-max vh-max p-relative u-select-none editor-container'>
            <AnimatePresence>
                <PreloadingOverlay key='preloading-overlay' />

                {showLoading && (
                    <Container key='model-loading' className='d-flex flex-center w-max h-max p-absolute model-loading-container'>
                        <Loader scale={0.7} />
                    </Container>
                )}
            </AnimatePresence>

            <CanvasWidgets trajectory={trajectory} currentTimestep={currentTimestep} scene3DRef={scene3DRef} />
            <CanvasPresenceAvatars users={canvasUsers} />

            <Container className='canvas-jobs-panel p-absolute'>
                <JobsHistoryViewer trajectoryId={trajectoryId} showHeader={false} queueFilter='analysis' />
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

            <KeyboardShortcutsPanel />
            <ShortcutFeedback />

            <ExposureSettingsWidget />
        </Container>
    );
};

export default React.memo(CanvasPage);
