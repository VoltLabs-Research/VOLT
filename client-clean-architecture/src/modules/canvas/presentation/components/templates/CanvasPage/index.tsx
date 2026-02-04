import React, { useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import useKeyboardShortcuts from '@/shared/presentation/hooks/use-keyboard-shortcuts';
import { useKeyboardShortcutsStore } from '@/shared/presentation/stores/use-keyboard-shortcuts-store';
import FractalScene, { type FractalSceneRef } from '@/modules/fractal/presentation/components/organisms/FractalScene';
import TimestepViewer from '@/modules/fractal/presentation/components/organisms/TimestepViewer';
import useCanvasCoordinator from '@/modules/canvas/presentation/hooks/use-canvas-coordinator';
import useCanvasPresence from '@/modules/canvas/presentation/hooks/use-canvas-presence';
import CanvasWidgets from '@/modules/canvas/presentation/components/atoms/CanvasWidgets';
import CanvasPresenceAvatars from '@/modules/canvas/presentation/components/atoms/CanvasPresenceAvatars';
import PreloadingOverlay from '@/modules/canvas/presentation/components/atoms/PreloadingOverlay';
import KeyboardShortcutsPanel from '@/shared/presentation/components/KeyboardShortcutsPanel';
import ShortcutFeedback from '@/shared/presentation/components/ShortcutFeedback';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import { useShallow } from 'zustand/react/shallow';
import { selectFractalSceneConfig, selectFractalSceneConfigSignature } from '@/modules/fractal/presentation/stores/editor/selectors';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import Loader from '@/shared/presentation/components/Loader';
import Container from '@/shared/presentation/components/Container';
import ExposureSettingsWidget from '@/modules/canvas/presentation/components/molecules/ExposureSettingsWidget';
import JobsHistoryViewer from '@/modules/trajectory/presentation/components/organisms/JobsHistoryViewer';
import { setSceneInteracting } from '@/modules/canvas/presentation/hooks/use-scene-interaction';
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
    const { searchParams, updateSearchParams } = useSearchParamsState();
    const scene3DRef = useRef<FractalSceneRef>(null);
    const trajectoryId = rawTrajectoryId ?? '';

    const { trajectory, currentTimestep, isLoading: trajectoryLoading } = useCanvasCoordinator({ trajectoryId });
    const { canvasUsers } = useCanvasPresence({ trajectoryId, enabled: !!trajectoryId });

    useKeyboardShortcuts();
    const setCurrentScope = useKeyboardShortcutsStore((s) => s.setCurrentScope);

    useEffect(() => {
        setCurrentScope('canvas');
        return () => setCurrentScope('global');
    }, [setCurrentScope]);

    const { isModelLoading, didPreload, isPlaying, setRendererStats } = useEditorStore(useShallow((s) => ({
        isModelLoading: s.isModelLoading,
        didPreload: s.didPreload ?? false,
        isPlaying: s.isPlaying,
        setRendererStats: s.setRendererStats
    })));
    const sceneConfigSignature = useEditorStore(selectFractalSceneConfigSignature);
    const sceneConfig = useMemo(() => selectFractalSceneConfig(useEditorStore.getState()), [sceneConfigSignature]);
    const analysisConfigId = searchParams.get('analysis') || undefined;

    useEffect(() => {
        if (!trajectory?.analysis?.length || analysisConfigId) return;
        const latest = trajectory.analysis[trajectory.analysis.length - 1] as any;
        if (!latest?._id) return;
        updateSearchParams({ analysis: latest._id }, { replace: true });
    }, [trajectory, analysisConfigId, updateSearchParams]);

    const { selectedIds: activeModifiers, toggleSelection: toggleModifier } = useSelectionParams({ paramName: 'modifiers' });
    const showCanvasGrid = searchParams.get('grid') !== 'false';
    const showPerformanceStats = activeModifiers.includes('performance-monitor');

    // Handle keyboard shortcut events for URL-based state
    useEffect(() => {
        const handleToggleWidgets = () => {
            const current = searchParams.get('widgets') !== 'false';
            updateSearchParams({ widgets: current ? 'false' : null }, { replace: true });
        };

        const handleToggleGrid = () => {
            const current = searchParams.get('grid') !== 'false';
            updateSearchParams({ grid: current ? 'false' : null }, { replace: true });
        };

        const handleToggleModifier = (e: CustomEvent<{ modifier: string }>) => {
            toggleModifier(e.detail.modifier);
        };

        window.addEventListener('Volt:toggle-widgets', handleToggleWidgets);
        window.addEventListener('Volt:toggle-grid', handleToggleGrid);
        window.addEventListener('Volt:toggle-modifier', handleToggleModifier as EventListener);

        return () => {
            window.removeEventListener('Volt:toggle-widgets', handleToggleWidgets);
            window.removeEventListener('Volt:toggle-grid', handleToggleGrid);
            window.removeEventListener('Volt:toggle-modifier', handleToggleModifier as EventListener);
        };
    }, [searchParams, updateSearchParams, toggleModifier]);

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

            <FractalScene
                ref={scene3DRef}
                config={sceneConfig}
                onInteractionChange={setSceneInteracting}
                onStats={setRendererStats}
                showPerformanceStats={showPerformanceStats}
                showGrid={showCanvasGrid}
            >
                <TimestepViewer
                    trajectoryId={trajectory?._id || ''}
                    currentTimestep={currentTimestep}
                    analysisId={analysisConfigId || 'default'}
                    scale={CANVAS_CONFIG.timestepViewerDefaults.scale}
                    rotation={CANVAS_CONFIG.timestepViewerDefaults.rotation}
                    position={CANVAS_CONFIG.timestepViewerDefaults.position}
                />
            </FractalScene>

            <KeyboardShortcutsPanel />
            <ShortcutFeedback />

            <ExposureSettingsWidget />
        </Container>
    );
};

export default React.memo(CanvasPage);
