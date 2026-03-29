import { useKeyboardShortcutsStore } from '../../../stores/use-keyboard-shortcuts-store';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { CanvasWorkspace } from '@/modules/canvas/hooks/use-canvas-url-state';
import useAnalysisStatus from '../../../hooks/use-analysis-status';
import { CanvasAnalysisStatusEnum, normalizeCanvasAnalysisStatus } from '../../../utilities/analysis-status';
import useCanvasCleanup from '../../../hooks/use-canvas-cleanup';
import useCanvasCoordinator from '../../../hooks/use-canvas-coordinator';
import useCanvasPresence from '../../../hooks/use-canvas-presence';
import useCanvasUrlState from '../../../hooks/use-canvas-url-state';
import useDownloadPluginListing from '../../../hooks/use-download-plugin-listing';
import useKeyboardShortcuts from '../../../hooks/use-keyboard-shortcuts';
import useResizable from '../../../hooks/use-resizable';
import useTeamJobs from '@/modules/jobs/hooks/use-team-jobs';
import useDownloadTrajectoryAnalyses from '@/modules/trajectory/hooks/trajectory/use-download-trajectory-analyses';
import useDownloadTrajectory from '@/modules/trajectory/hooks/trajectory/use-download-trajectory';
import CanvasPresence from '../../atoms/CanvasPresence';
import PreloadingOverlay from '../../atoms/PreloadingOverlay';
import ResizeHandle from '../../atoms/ResizeHandle';
import ExposureSettingsWidget from '../../molecules/ExposureSettingsWidget';
import ShortcutFeedback from '../../molecules/ShortcutFeedback';
import AnalysisListingDownloadModal, {
    ANALYSIS_LISTING_DOWNLOAD_MODAL_ID
} from '../../organisms/AnalysisListingDownloadModal';
import KeyboardShortcutsPanel from '../../organisms/KeyboardShortcutsPanel';
import ObjectsPanel from '../../organisms/ObjectsPanel';
import PluginResultsViewer from '../../organisms/PluginResultsViewer';
import RightPanel from '../../organisms/RightPanel';
import StatusBar from '../../organisms/StatusBar';
import Timeline from '../../organisms/Timeline';
import TopToolbar from '../../organisms/TopToolbar';
import Viewport from '../../organisms/Viewport';
import useFractalSceneConfig from '@/modules/canvas/hooks/use-fractal-scene-config';
import CanvasRasterViewport from '@/modules/raster/components/organisms/CanvasRasterViewport';
import { ResizeDirection } from '@/modules/canvas/hooks/use-resizable';

import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import { Download, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import ScriptingWorkspace from '@/modules/scripting/components/organisms/ScriptingWorkspace';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import { openModal } from '@/shared/presentation/components/Modal';
import Tooltip from '@/shared/presentation/components/Tooltip';
import useTip from '@/shared/tips/use-tip';

import type { FractalSceneRef } from '@/modules/fractal/components/organisms/FractalScene';
import type { DownloadAnalysisListingParams } from '@/modules/canvas/hooks/use-download-plugin-listing';
import type { RasterContainerId, RasterContainerSelection } from '@/modules/raster/types/container-selection';

import './CanvasPage.css';
import { createInitialRasterContainerSelections } from '@/modules/raster/types/container-selection';

interface DownloadExposureListingParams {
    pluginId: string;
    exposureId: string;
    analysisId?: string;
    trajectoryId?: string;
    exposureName?: string;
};

const CanvasPage = () => {
    usePageTitle('Canvas');
    const { trajectoryId: rawTrajectoryId } = useParams<{ trajectoryId?: string }>();
    const trajectoryId = rawTrajectoryId ?? '';

    useCanvasCleanup();
    const { trajectory, currentTimestep, isLoading: trajectoryLoading } = useCanvasCoordinator({ trajectoryId });
    const { canvasUsers } = useCanvasPresence({ trajectoryId, enabled: !!trajectoryId });
    useTeamJobs();

    useTip('canvas-shortcuts', {
        enabled: Boolean(trajectoryId) && !trajectoryLoading
    });

    useKeyboardShortcuts();
    const setCurrentScope = useKeyboardShortcutsStore((s) => s.setCurrentScope);

    useEffect(() => {
        setCurrentScope('canvas');
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
        showGizmo,
        resultsPluginId,
        showWidgets,
        searchParams,
        activeWorkspace,
        selectedNotebookId
    } = useCanvasUrlState({ trajectory });
    const showStatusBar = searchParams.get('statusBar') !== 'false';
    const isRasterWorkspace = activeWorkspace === CanvasWorkspace.Raster;
    const isScriptingWorkspace = activeWorkspace === CanvasWorkspace.Scripting;
    const { downloadListing, downloadAnalysisListings, isDownloading } = useDownloadPluginListing();
    const {
        downloadTrajectoryAnalyses,
        isDownloading: isDownloadingTrajectoryAnalyses
    } = useDownloadTrajectoryAnalyses();
    const { downloadTrajectory, isDownloading: isExportingTrajectory } = useDownloadTrajectory();
    const { statusMap } = useAnalysisStatus({ trajectoryId: trajectory?._id, enabled: !!trajectory?._id });
    const [scriptingJupyterUrl, setScriptingJupyterUrl] = useState<string | null>(null);
    const [rasterContainerSelections, setRasterContainerSelections] = useState<RasterContainerSelection[]>(() => createInitialRasterContainerSelections());
    const [activeRasterContainerId, setActiveRasterContainerId] = useState<RasterContainerId>('container-1');
    const [downloadAnalysisModalTargetId, setDownloadAnalysisModalTargetId] = useState<string | null>(null);

    useEffect(() => {
        setRasterContainerSelections(createInitialRasterContainerSelections());
        setActiveRasterContainerId('container-1');
    }, [trajectoryId]);

    const hasFrames = !!(trajectory?.frames && trajectory.frames.length > 0);
    const showLoading = useMemo(() =>
        trajectoryLoading || !trajectory || (hasFrames && ((isModelLoading && !(didPreload && isPlaying)) || currentTimestep === undefined)),
        [isModelLoading, didPreload, isPlaying, trajectory, hasFrames, currentTimestep, trajectoryLoading]
    );

    const leftPanel = useResizable({
        direction: ResizeDirection.Horizontal,
        initialSize: 250,
        minSize: 180,
        maxSize: 420
    });

    const rightPanel = useResizable({
        direction: ResizeDirection.Horizontal,
        initialSize: 268,
        minSize: 200,
        maxSize: 420,
        growPositive: false
    });

    const timeline = useResizable({
        direction: ResizeDirection.Vertical,
        initialSize: 65,
        minSize: 60,
        maxSize: 360,
        growPositive: false
    });

    const handleTimelineTabChange = useCallback((tab: string) => {
        timeline.setSize(tab === 'timeline' ? 65 : 280);
    }, [timeline.setSize]);

    const handleDownloadExposureListing = useCallback((params: DownloadExposureListingParams) => {
        downloadListing(params);
    }, [downloadListing]);

    const handleUpdateRasterContainerSelection = useCallback((containerId: RasterContainerId, updates: Partial<RasterContainerSelection>) => {
        setRasterContainerSelections((currentSelections) => currentSelections.map((selection) => {
            if (selection.id !== containerId) {
                return selection;
            }

            return {
                ...selection,
                ...updates
            };
        }));
    }, []);

    const selectedAnalysisStatus = useMemo(() => {
        if (!analysisId) {
            return undefined;
        }

        return statusMap.get(analysisId)?.status
            ?? normalizeCanvasAnalysisStatus(trajectory?.analysis?.find((analysis) => analysis._id === analysisId)?.status);
    }, [analysisId, statusMap, trajectory?.analysis]);

    const canDownloadAnalysisListing = Boolean(analysisId && selectedAnalysisStatus === CanvasAnalysisStatusEnum.Completed);
    const canDownloadTrajectoryAnalyses = Boolean(
        trajectory?._id
        && !isDownloadingTrajectoryAnalyses
    );
    const canExportTrajectory = Boolean(trajectory?._id && hasFrames && !isExportingTrajectory);

    const handleDownloadAnalysisListing = useCallback((targetAnalysisId?: string) => {
        const resolvedAnalysisId = targetAnalysisId ?? analysisId;

        if (!resolvedAnalysisId) {
            return;
        }

        setDownloadAnalysisModalTargetId(resolvedAnalysisId);
        openModal(ANALYSIS_LISTING_DOWNLOAD_MODAL_ID);
    }, [analysisId]);

    const handleConfirmAnalysisDownload = useCallback((params: DownloadAnalysisListingParams) => {
        return downloadAnalysisListings({
            ...params,
            format: params.format ?? 'csv'
        });
    }, [downloadAnalysisListings]);

    const handleExportTrajectory = useCallback(() => {
        if (!trajectory?._id) {
            return;
        }

        void downloadTrajectory({
            trajectoryId: trajectory._id,
            filename: trajectory.name || trajectory._id,
            archive: true
        });
    }, [downloadTrajectory, trajectory?._id, trajectory?.name]);

    const handleDownloadTrajectoryAnalyses = useCallback(() => {
        if (!trajectory?._id) {
            return;
        }

        void downloadTrajectoryAnalyses({
            trajectoryId: trajectory._id,
            filename: trajectory.name || trajectory._id
        });
    }, [downloadTrajectoryAnalyses, trajectory?._id, trajectory?.name]);

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

    const viewportHeaderActions = (canDownloadAnalysisListing || scriptingHeaderAction)
        ? (
            <Container className="d-flex items-center gap-05">
                {canDownloadAnalysisListing && (
                    <Tooltip content="Download analysis listings">
                        <Button
                            variant="ghost"
                            intent="canvas"
                            shape="rounded"
                            size="sm"
                            className="font-size-05 canvas-btn-compact"
                            leftIcon={<span className="d-flex items-center content-center f-shrink-0"><Download size={12} /></span>}
                            onClick={() => handleDownloadAnalysisListing()}
                            isLoading={isDownloading}
                        >
                            Download Analysis
                        </Button>
                    </Tooltip>
                )}
                {scriptingHeaderAction}
            </Container>
        )
        : null;

    let viewportBodyContent = undefined;
    if (isScriptingWorkspace) {
        viewportBodyContent = (
            <ScriptingWorkspace
                trajectoryId={trajectoryId}
                notebookId={selectedNotebookId}
                onJupyterUrlChange={setScriptingJupyterUrl}
            />
        );
    }

    if (isRasterWorkspace) {
        viewportBodyContent = (
            <CanvasRasterViewport
                trajectoryId={trajectoryId}
                trajectory={trajectory}
                currentTimestep={currentTimestep}
                containerSelections={rasterContainerSelections}
                onUpdateContainerSelection={handleUpdateRasterContainerSelection}
            />
        );
    }

    return (
        <Container className="canvas-editor-root d-flex column vh-max wh-max overflow-hidden p-relative">
            <TopToolbar
                canExport={canExportTrajectory}
                canDownloadAnalyses={canDownloadTrajectoryAnalyses}
                onExport={handleExportTrajectory}
                onDownloadAnalyses={handleDownloadTrajectoryAnalyses}
            />
            <PreloadingOverlay />
            <CanvasPresence users={canvasUsers} />

            <Container className="canvas-editor-main d-flex flex-1 overflow-hidden p-relative min-h-0">
                <Container id="canvas-left-panel" className="canvas-left-panel d-flex column f-shrink-0 min-h-0" style={{ width: leftPanel.size }}>
                    <Container id="canvas-left-panel-top" className="canvas-left-panel-top d-flex column min-h-0 overflow-hidden flex-1">
                        <ObjectsPanel
                            trajectory={trajectory}
                            onDownloadAnalysis={handleDownloadAnalysisListing}
                            onDownloadExposureListing={handleDownloadExposureListing}
                            rasterContainerSelections={rasterContainerSelections}
                            activeRasterContainerId={activeRasterContainerId}
                            onSetActiveRasterContainer={setActiveRasterContainerId}
                            onUpdateRasterContainerSelection={handleUpdateRasterContainerSelection}
                        />
                    </Container>
                </Container>

                <ResizeHandle
                    direction={ResizeDirection.Horizontal}
                    isDragging={leftPanel.isDragging}
                    label="Resize left sidebar"
                    controls="canvas-left-panel"
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
                            showGizmo={showGizmo}
                            isLoading={isRasterWorkspace ? false : showLoading}
                            sceneRef={sceneRef}
                            bodyContent={viewportBodyContent}
                            hideGradient={isScriptingWorkspace || isRasterWorkspace}
                            renderScene={!isScriptingWorkspace && !isRasterWorkspace}
                            showSceneActions={!isRasterWorkspace}
                            headerActionsBeforePerformance={viewportHeaderActions}
                        />
                    </Container>
                    {!isScriptingWorkspace && (
                        <>
                            <ResizeHandle
                                direction={ResizeDirection.Vertical}
                                isDragging={timeline.isDragging}
                                label="Resize timeline"
                                controls="canvas-center-timeline"
                                {...timeline.handleProps}
                            />
                            <Container id="canvas-center-timeline" className="canvas-center-timeline d-flex column f-shrink-0 min-h-0" style={{ height: timeline.size }}>
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
                    direction={ResizeDirection.Horizontal}
                    isDragging={rightPanel.isDragging}
                    label="Resize right sidebar"
                    controls="canvas-right-panel"
                    {...rightPanel.handleProps}
                />

                <Container id="canvas-right-panel" className="canvas-right-panel-container d-flex column f-shrink-0" style={{ width: rightPanel.size }}>
                    <RightPanel trajectory={trajectory} trajectoryId={trajectoryId} analysisId={analysisId} currentTimestep={currentTimestep} />
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
            <AnalysisListingDownloadModal
                analysisId={downloadAnalysisModalTargetId}
                pluginId={resultsPluginId}
                isDownloading={isDownloading}
                onDownload={handleConfirmAnalysisDownload}
                onClose={() => setDownloadAnalysisModalTargetId(null)}
            />
            <KeyboardShortcutsPanel />
            <ShortcutFeedback />
            <ExposureSettingsWidget />

        </Container>
    );
};

export default CanvasPage;
