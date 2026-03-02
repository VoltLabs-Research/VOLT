import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { ExternalLink } from 'lucide-react';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import useFractalSceneConfig from '@/modules/canvas/presentation/hooks/use-fractal-scene-config';
import type { FractalSceneRef } from '@/modules/fractal/presentation/components/organisms/FractalScene';
import useCanvasCoordinator from '../../../hooks/use-canvas-coordinator';
import useCanvasPresence from '../../../hooks/use-canvas-presence';
import useCanvasUrlState from '../../../hooks/use-canvas-url-state';
import useKeyboardShortcuts from '../../../hooks/use-keyboard-shortcuts';
import { useKeyboardShortcutsStore } from '../../../stores/use-keyboard-shortcuts-store';
import useDownloadPluginListing from '../../../hooks/use-download-plugin-listing';
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
import ScriptingWorkspace from '@/modules/scripting/presentation/components/organisms/ScriptingWorkspace';
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
    const {
        analysisId,
        showGrid,
        resultsPluginId,
        showWidgets,
        searchParams,
        activeWorkspace,
        selectedNotebookId
    } = useCanvasUrlState({ trajectory });
    const showStatusBar = searchParams.get('statusBar') !== 'false';
    const isScriptingWorkspace = activeWorkspace === 'scripting';
    const { downloadListing } = useDownloadPluginListing();
    const [scriptingJupyterUrl, setScriptingJupyterUrl] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            useEditorStore.getState().resetModel();
            useEditorStore.getState().resetPlayback();
        };
    }, []);

    const hasFrames = !!(trajectory?.frames && trajectory.frames.length > 0);
    const showLoading = useMemo(() =>
        trajectoryLoading || !trajectory || (hasFrames && ((isModelLoading && !(didPreload && isPlaying)) || currentTimestep === undefined)),
        [isModelLoading, didPreload, isPlaying, trajectory, hasFrames, currentTimestep, trajectoryLoading]
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

    const handleDownloadExposureListing = useCallback((params: {
        pluginId: string;
        exposureId: string;
        analysisId?: string;
        trajectoryId?: string;
        exposureName?: string;
    }) => {
        downloadListing(params);
    }, [downloadListing]);

    const leftSplit = useResizable({
        direction: 'vertical',
        initialSize: 56,
        minSize: 20,
        maxSize: 80
    });

    const scriptingHeaderAction = isScriptingWorkspace && scriptingJupyterUrl
        ? (
            <Tooltip content="Open Jupyter in new tab">
                <Button
                    variant="ghost"
                    intent="canvas"
                    shape="rounded"
                    size="sm"
                    className="font-size-05 canvas-btn-compact"
                    leftIcon={<span className="d-flex items-center content-center f-shrink-0"><ExternalLink size={12} /></span>}
                    onClick={() => window.open(scriptingJupyterUrl, '_blank', 'noopener,noreferrer')}
                >
                    Open in New Tab
                </Button>
            </Tooltip>
        )
        : null;

    return (
        <Container className="canvas-editor-root d-flex column vh-max wh-max overflow-hidden p-relative">
            <TopToolbar />
            <PreloadingOverlay />
            <CanvasPresence users={canvasUsers} />

            <Container className="canvas-editor-main d-flex flex-1 overflow-hidden p-relative min-h-0">
                <Container className="canvas-left-panel d-flex column f-shrink-0" style={{ width: leftPanel.size }}>
                    <Container className="canvas-left-panel-top d-flex column min-h-0 overflow-hidden" style={{ flex: `1 1 ${100 - leftSplit.size}%` }}>
                        <ObjectsPanel trajectory={trajectory} onDownloadExposureListing={handleDownloadExposureListing} />
                    </Container>
                    <ResizeHandle
                        direction="vertical"
                        isDragging={leftSplit.isDragging}
                        {...leftSplit.handleProps}
                    />
                    <Container className="canvas-left-panel-bottom d-flex column min-h-0 overflow-hidden" style={{ flex: `0 0 ${leftSplit.size}%` }}>
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
                            bodyContent={isScriptingWorkspace
                                ? (
                                    <ScriptingWorkspace
                                        trajectoryId={trajectoryId}
                                        notebookId={selectedNotebookId}
                                        onJupyterUrlChange={setScriptingJupyterUrl}
                                    />
                                )
                                : undefined}
                            hideGradient={isScriptingWorkspace}
                            headerActionsBeforePerformance={scriptingHeaderAction}
                        />
                    </Container>
                    {!isScriptingWorkspace && (
                        <>
                            <ResizeHandle
                                direction="vertical"
                                isDragging={timeline.isDragging}
                                {...timeline.handleProps}
                            />
                            <Container className="canvas-center-timeline d-flex column f-shrink-0" style={{ height: timeline.size }}>
                                <Timeline
                                    sceneRef={sceneRef}
                                    trajectory={trajectory}
                                    analysisId={analysisId}
                                    onTabChange={handleTimelineTabChange}
                                    onDownloadExposureListing={handleDownloadExposureListing}
                                />
                            </Container>
                        </>
                    )}
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
            {showWidgets && resultsPluginId && analysisId && (
                <PluginResultsViewer
                    pluginId={resultsPluginId}
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
