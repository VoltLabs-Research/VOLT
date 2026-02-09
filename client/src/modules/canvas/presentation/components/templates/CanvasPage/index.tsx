import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import Container from '@/shared/presentation/components/Container';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import useFractalSceneConfig from '@/modules/canvas/presentation/hooks/use-fractal-scene-config';
import type { FractalSceneRef } from '@/modules/fractal/presentation/components/organisms/FractalScene';
import useCanvasCoordinator from '../../../hooks/use-canvas-coordinator';
import useCanvasPresence from '../../../hooks/use-canvas-presence';
import useCanvasUrlState from '../../../hooks/use-canvas-url-state';
import useKeyboardShortcuts from '../../../hooks/use-keyboard-shortcuts';
import { useKeyboardShortcutsStore } from '../../../stores/use-keyboard-shortcuts-store';
import './CanvasPage.css';
import ResizeHandle from '../../atoms/ResizeHandle';
import CanvasPresence from '../../atoms/CanvasPresence';
import PreloadingOverlay from '../../atoms/PreloadingOverlay';
import ShortcutFeedback from '../../molecules/ShortcutFeedback';
import ExposureSettingsWidget from '../../molecules/ExposureSettingsWidget';
import TopToolbar from '../../organisms/TopToolbar';
import ObjectsPanel from '../../organisms/ObjectsPanel';
import TexturesPanel from '../../organisms/TexturesPanel';
import Viewport from '../../organisms/Viewport';
import RightPanel from '../../organisms/RightPanel';
import Timeline from '../../organisms/Timeline';
import StatusBar from '../../organisms/StatusBar';
import PluginResultsViewer from '../../organisms/PluginResultsViewer';
import KeyboardShortcutsPanel from '../../organisms/KeyboardShortcutsPanel';
import useResizable from '../../../hooks/use-resizable';

const CanvasPage = () => {
    usePageTitle('Canvas');
    const { trajectoryId: rawTrajectoryId } = useParams<{ trajectoryId?: string }>();
    const trajectoryId = rawTrajectoryId ?? '';

    const { trajectory, currentTimestep, isLoading: trajectoryLoading } = useCanvasCoordinator({ trajectoryId });
    const { canvasUsers } = useCanvasPresence({ trajectoryId, enabled: !!trajectoryId });

    useKeyboardShortcuts();
    const setCurrentScope = useKeyboardShortcutsStore((s) => s.setCurrentScope);

    useEffect(() => {
        setCurrentScope('canvas');
        return () => setCurrentScope('global');
    }, [setCurrentScope]);

    const { isModelLoading, didPreload, isPlaying } = useEditorStore(useShallow((s) => ({
        isModelLoading: s.isModelLoading,
        didPreload: s.didPreload,
        isPlaying: s.isPlaying
    })));

    const sceneConfig = useFractalSceneConfig();
    const sceneRef = useRef<FractalSceneRef>(null);
    const { analysisId, showGrid, resultsSlug, showWidgets, searchParams } = useCanvasUrlState({ trajectory });
    const showStatusBar = searchParams.get('statusBar') !== 'false';

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

    const leftPanel = useResizable({
        direction: 'horizontal',
        initialSize: 250,
        minSize: 180,
        maxSize: 420
    });

    const rightPanel = useResizable({
        direction: 'horizontal',
        initialSize: 268,
        minSize: 200,
        maxSize: 420,
        growPositive: false
    });

    const timeline = useResizable({
        direction: 'vertical',
        initialSize: 65,
        minSize: 60,
        maxSize: 360,
        growPositive: false
    });

    const handleTimelineTabChange = useCallback((tab: string) => {
        timeline.setSize(tab === 'timeline' ? 65 : 280);
    }, [timeline.setSize]);

    const leftSplit = useResizable({
        direction: 'vertical',
        initialSize: 56,
        minSize: 20,
        maxSize: 80
    });

    return (
        <Container className="canvas-editor-root d-flex column vh-max wh-max overflow-hidden p-relative">
            <TopToolbar />
            <PreloadingOverlay />
            <CanvasPresence users={canvasUsers} />

            <Container className="canvas-editor-main d-flex flex-1 overflow-hidden p-relative min-h-0">
                <Container className="canvas-left-panel d-flex column f-shrink-0" style={{ width: leftPanel.size }}>
                    <Container className="canvas-left-panel-top d-flex column min-h-0" style={{ flex: `1 1 ${100 - leftSplit.size}%` }}>
                        <ObjectsPanel trajectory={trajectory} />
                    </Container>
                    <ResizeHandle
                        direction="vertical"
                        isDragging={leftSplit.isDragging}
                        {...leftSplit.handleProps}
                    />
                    <Container className="canvas-left-panel-bottom d-flex column min-h-0" style={{ flex: `0 0 ${leftSplit.size}%` }}>
                        <TexturesPanel trajectory={trajectory} />
                    </Container>
                </Container>

                <ResizeHandle
                    direction="horizontal"
                    isDragging={leftPanel.isDragging}
                    {...leftPanel.handleProps}
                />

                <Container className="canvas-center-panel d-flex column flex-1 overflow-hidden">
                    <Container className="canvas-center-viewport d-flex column flex-1 overflow-hidden">
                        <Viewport
                            trajectory={trajectory}
                            currentTimestep={currentTimestep}
                            sceneConfig={sceneConfig}
                            analysisId={analysisId}
                            showGrid={showGrid}
                            isLoading={showLoading}
                            sceneRef={sceneRef}
                        />
                    </Container>
                    <ResizeHandle
                        direction="vertical"
                        isDragging={timeline.isDragging}
                        {...timeline.handleProps}
                    />
                    <Container className="canvas-center-timeline d-flex column f-shrink-0" style={{ height: timeline.size }}>
                        <Timeline sceneRef={sceneRef} trajectory={trajectory} analysisId={analysisId} onTabChange={handleTimelineTabChange} />
                    </Container>
                </Container>

                <ResizeHandle
                    direction="horizontal"
                    isDragging={rightPanel.isDragging}
                    {...rightPanel.handleProps}
                />

                <Container className="canvas-right-panel-container d-flex column f-shrink-0" style={{ width: rightPanel.size }}>
                    <RightPanel trajectoryId={trajectoryId} analysisId={analysisId} currentTimestep={currentTimestep} />
                </Container>
            </Container>

            {showStatusBar && trajectory && currentTimestep !== undefined && (
                <StatusBar trajectory={trajectory} currentTimestep={currentTimestep} />
            )}
            {showWidgets && resultsSlug && (
                <PluginResultsViewer
                    pluginSlug={resultsSlug}
                    analysisId={analysisId}
                />
            )}
            <KeyboardShortcutsPanel />
            <ShortcutFeedback />
            <ExposureSettingsWidget />
        </Container>
    );
};

export default CanvasPage;
