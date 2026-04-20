import { useKeyboardShortcutsStore } from '../../../stores/use-keyboard-shortcuts-store';
import { findCachedAnalysisById } from '@/modules/analysis/services/cache';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { CanvasWorkspace } from '@/modules/canvas/hooks/use-canvas-url-state';
import useAnalysisStatus from '../../../hooks/use-analysis-status';
import { CanvasAnalysisStatusEnum, normalizeCanvasAnalysisStatus } from '../../../utilities/analysis-status';
import useCanvasCleanup from '../../../hooks/use-canvas-cleanup';
import useCanvasCoordinator from '../../../hooks/use-canvas-coordinator';
import useCanvasPresence from '../../../hooks/use-canvas-presence';
import useCanvasUrlState from '../../../hooks/use-canvas-url-state';
import useCanvasWorkspace from '@/modules/canvas/collaboration/use-canvas-workspace';
import useWorkspaceCursors from '@/modules/canvas/collaboration/use-workspace-cursors';
import WorkspaceCursorsOverlay from '../../atoms/WorkspaceCursorsOverlay';
import { useLocalGlbStore } from '@/modules/canvas/stores/use-local-glb-store';
import useDownloadPluginListing from '../../../hooks/use-download-plugin-listing';
import useKeyboardShortcuts from '../../../hooks/use-keyboard-shortcuts';
import useResizable from '../../../hooks/use-resizable';
import useViewportNarrow from '../../../hooks/use-viewport-narrow';
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
import CommandPalette from '../../organisms/CommandPalette';
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
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { Download, ExternalLink, PanelLeft, PanelRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import ScriptingWorkspace from '@/modules/scripting/components/organisms/ScriptingWorkspace';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import ErrorBoundary from '@/shared/presentation/components/ErrorBoundary';
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
    const { trajectoryId: rawTrajectoryId, ownerId: ownerIdParam } = useParams<{ trajectoryId?: string; ownerId?: string }>();
    const trajectoryId = rawTrajectoryId ?? '';
    const isLocalGlbViewer = !rawTrajectoryId;

    useCanvasCleanup();
    const {
        trajectory,
        availableTimesteps,
        currentTimestep,
        isLoading: trajectoryLoading
    } = useCanvasCoordinator({ trajectoryId });
    const { canvasUsers, broadcastTimestep } = useCanvasPresence({ trajectoryId, enabled: !!trajectoryId });
    const viewportContainerRef = useRef<HTMLDivElement | null>(null);
    const {
        peersInLobby,
        ownerId: workspaceOwnerId,
        navigateToWorkspace
    } = useCanvasWorkspace({
        trajectoryId,
        ownerId: ownerIdParam,
        enabled: !!trajectoryId
    });
    const { cursors: workspaceCursors } = useWorkspaceCursors({
        trajectoryId,
        ownerId: workspaceOwnerId,
        enabled: !!trajectoryId && !!workspaceOwnerId,
        containerRef: viewportContainerRef
    });
    useTip('canvas-shortcuts', {
        enabled: Boolean(trajectoryId) && !trajectoryLoading
    });

    useKeyboardShortcuts({ trajectoryId, availableTimesteps, currentTimestep });
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
        selectedNotebookId,
        setActiveWorkspace
    } = useCanvasUrlState();
    const localGlbUrl = useLocalGlbStore((s) => s.localGlbUrl);
    const clearLocalGlb = useLocalGlbStore((s) => s.clearLocalGlb);
    const forcedGlbUrl = isLocalGlbViewer ? localGlbUrl : null;
    const showStatusBar = searchParams.get('statusBar') !== 'false';
    const isRasterWorkspace = !isLocalGlbViewer && activeWorkspace === CanvasWorkspace.Raster;
    const isScriptingWorkspace = !isLocalGlbViewer && activeWorkspace === CanvasWorkspace.Scripting;
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
    const isNarrowViewport = useViewportNarrow();
    const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
    const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

    useEffect(() => {
        if (!isNarrowViewport) {
            setLeftDrawerOpen(false);
            setRightDrawerOpen(false);
        }
    }, [isNarrowViewport]);

    useEffect(() => {
        if (!isLocalGlbViewer) {
            return;
        }

        setActiveWorkspace(CanvasWorkspace.Modeling, { replace: true });
    }, [isLocalGlbViewer, setActiveWorkspace]);

    const wasLocalGlbViewerRef = useRef(isLocalGlbViewer);
    useEffect(() => {
        const wasLocalGlbViewer = wasLocalGlbViewerRef.current;
        if (wasLocalGlbViewer && !isLocalGlbViewer) {
            clearLocalGlb();
        }

        wasLocalGlbViewerRef.current = isLocalGlbViewer;
    }, [clearLocalGlb, isLocalGlbViewer]);

    useEffect(() => {
        const editorState = useEditorStore.getState();
        editorState.resetPlayback();
        editorState.resetModel();
    }, [trajectoryId, isLocalGlbViewer]);

    useEffect(() => {
        if (!trajectoryId || currentTimestep === undefined) return;
        const timeoutId = window.setTimeout(() => broadcastTimestep(currentTimestep), 200);
        return () => window.clearTimeout(timeoutId);
    }, [trajectoryId, currentTimestep, broadcastTimestep]);

    const hasFrames = !!(trajectory?.frames && trajectory.frames.length > 0);
    const showLoading = useMemo(() =>
        isLocalGlbViewer
            ? false
            : trajectoryLoading || !trajectory || (hasFrames && ((isModelLoading && !(didPreload && isPlaying)) || currentTimestep === undefined)),
        [isLocalGlbViewer, isModelLoading, didPreload, isPlaying, trajectory, hasFrames, currentTimestep, trajectoryLoading]
    );

    const leftPanel = useResizable({
        direction: ResizeDirection.Horizontal,
        initialSize: 250,
        minSize: 180,
        maxSize: 420,
        storageKey: 'volt:canvas:left-panel-size'
    });

    const rightPanel = useResizable({
        direction: ResizeDirection.Horizontal,
        initialSize: 268,
        minSize: 200,
        maxSize: 420,
        growPositive: false,
        storageKey: 'volt:canvas:right-panel-size'
    });

    const timeline = useResizable({
        direction: ResizeDirection.Vertical,
        initialSize: 65,
        minSize: 60,
        maxSize: 360,
        growPositive: false,
        storageKey: 'volt:canvas:timeline-size'
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

        const selectedAnalysis = findCachedAnalysisById({
            analysisId,
            trajectoryId: trajectory?._id,
            fallbackAnalyses: trajectory?.analysis ?? []
        });

        return statusMap.get(analysisId)?.status ?? normalizeCanvasAnalysisStatus(selectedAnalysis?.status);
    }, [analysisId, statusMap, trajectory?._id, trajectory?.analysis]);

    const selectedTeamId = useSelectedTeamId();
    const { canAccess: canAccessTeamPermissions } = useTeamPermissions();
    const trajectoryTeamId = useMemo(() => {
        const team = trajectory?.team;
        if (!team) {
            return undefined;
        }
        if (typeof team === 'string') {
            return team;
        }
        if (typeof team === 'object' && '_id' in team) {
            return team._id;
        }
        return undefined;
    }, [trajectory?.team]);

    const shareInfo = useMemo(() => {
        if (isLocalGlbViewer || !trajectory?._id) {
            return undefined;
        }

        const isTeamOwner = Boolean(
            selectedTeamId
            && trajectoryTeamId
            && selectedTeamId === trajectoryTeamId
        );
        const canManageVisibility = isTeamOwner
            && canAccessTeamPermissions(['trajectory:update']);

        return {
            trajectoryId: trajectory._id,
            isPublic: Boolean(trajectory.isPublic),
            canManageVisibility
        };
    }, [canAccessTeamPermissions, isLocalGlbViewer, selectedTeamId, trajectory?._id, trajectory?.isPublic, trajectoryTeamId]);

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
    if (isLocalGlbViewer && !forcedGlbUrl) {
        viewportBodyContent = (
            <Container className="d-flex items-center content-center w-max h-max">
                <EmptyState
                    title='Drop a GLB file to preview'
                    description='Use the global dashboard dropzone to open a local GLB viewer.'
                />
            </Container>
        );
    } else if (isScriptingWorkspace) {
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
        <Container className={`canvas-editor-root d-flex column vh-max wh-max overflow-hidden p-relative${isNarrowViewport ? ' canvas-editor-root--narrow' : ''}`}>
            <TopToolbar
                canExport={canExportTrajectory}
                canDownloadAnalyses={canDownloadTrajectoryAnalyses}
                onExport={handleExportTrajectory}
                onDownloadAnalyses={handleDownloadTrajectoryAnalyses}
                localGlbMode={isLocalGlbViewer}
                workspacePeers={peersInLobby}
                workspaceActiveOwnerId={workspaceOwnerId}
                onSelectWorkspacePeer={navigateToWorkspace}
                share={shareInfo}
            />
            <PreloadingOverlay />
            <CanvasPresence users={canvasUsers} />

            {isNarrowViewport && (leftDrawerOpen || rightDrawerOpen) && (
                <button
                    type='button'
                    className='canvas-panel-drawer-backdrop'
                    aria-label='Close panel'
                    onClick={() => { setLeftDrawerOpen(false); setRightDrawerOpen(false); }}
                />
            )}

            <Container className="canvas-editor-main d-flex flex-1 overflow-hidden p-relative min-h-0">
                {!isLocalGlbViewer && (
                    <>
                        {isNarrowViewport && !leftDrawerOpen && (
                            <button
                                type='button'
                                className='canvas-panel-drawer-toggle canvas-panel-drawer-toggle--left'
                                onClick={() => setLeftDrawerOpen(true)}
                                aria-label='Open objects panel'
                                aria-expanded={leftDrawerOpen}
                                aria-controls='canvas-left-panel'
                            >
                                <PanelLeft size={14} aria-hidden='true' />
                            </button>
                        )}
                        <Container
                            id="canvas-left-panel"
                            className="canvas-left-panel d-flex column f-shrink-0 min-h-0"
                            style={{ width: leftPanel.size }}
                            data-drawer-open={isNarrowViewport ? (leftDrawerOpen ? 'true' : 'false') : undefined}
                        >
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
                    </>
                )}

                <Container className="canvas-center-panel d-flex column flex-1 overflow-hidden">
                    <Container
                        className="canvas-center-viewport d-flex column flex-1 overflow-hidden p-relative"
                        ref={viewportContainerRef as React.RefObject<HTMLDivElement>}
                    >
                        <ErrorBoundary
                            fallbackTitle='Viewport crashed'
                            fallbackDescription='The 3D viewport hit an unexpected error. Reset to recover without losing your trajectory data.'
                            onError={() => {
                                useEditorStore.getState().resetModel();
                            }}
                        >
                            <Viewport
                                trajectory={trajectory}
                                currentTimestep={currentTimestep}
                                sceneConfig={sceneConfig}
                                analysisId={analysisId}
                                forcedGlbUrl={forcedGlbUrl}
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
                        </ErrorBoundary>
                        <WorkspaceCursorsOverlay
                            cursors={workspaceCursors}
                            containerRef={viewportContainerRef}
                        />
                    </Container>
                    {!isLocalGlbViewer && !isScriptingWorkspace && (
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
                                    trajectoryId={trajectoryId}
                                    currentTimestep={currentTimestep}
                                    availableTimesteps={availableTimesteps}
                                    analysisId={analysisId}
                                    presenceUsers={canvasUsers}
                                    onTabChange={handleTimelineTabChange}
                                    onDownloadExposureListing={handleDownloadExposureListing}
                                />
                            </Container>
                        </>
                    )}
                </Container>

                {!isLocalGlbViewer && (
                    <>
                        <ResizeHandle
                            direction={ResizeDirection.Horizontal}
                            isDragging={rightPanel.isDragging}
                            label="Resize right sidebar"
                            controls="canvas-right-panel"
                            {...rightPanel.handleProps}
                        />

                        {isNarrowViewport && !rightDrawerOpen && (
                            <button
                                type='button'
                                className='canvas-panel-drawer-toggle canvas-panel-drawer-toggle--right'
                                onClick={() => setRightDrawerOpen(true)}
                                aria-label='Open plugins panel'
                                aria-expanded={rightDrawerOpen}
                                aria-controls='canvas-right-panel'
                            >
                                <PanelRight size={14} aria-hidden='true' />
                            </button>
                        )}
                        <Container
                            id="canvas-right-panel"
                            className="canvas-right-panel-container d-flex column f-shrink-0"
                            style={{ width: rightPanel.size }}
                            data-drawer-open={isNarrowViewport ? (rightDrawerOpen ? 'true' : 'false') : undefined}
                        >
                            <RightPanel trajectory={trajectory} trajectoryId={trajectoryId} analysisId={analysisId} currentTimestep={currentTimestep} />
                        </Container>
                    </>
                )}
            </Container>

            {!isLocalGlbViewer && showStatusBar && (
                <StatusBar trajectory={trajectory} currentTimestep={currentTimestep} />
            )}
            {!isLocalGlbViewer && showWidgets && resultsPluginId && analysisId && (
                <PluginResultsViewer
                    pluginId={resultsPluginId}
                    analysisId={analysisId}
                />
            )}
            <AnalysisListingDownloadModal
                analysisId={downloadAnalysisModalTargetId}
                isDownloading={isDownloading}
                onDownload={handleConfirmAnalysisDownload}
                onClose={() => setDownloadAnalysisModalTargetId(null)}
            />
            <KeyboardShortcutsPanel />
            <CommandPalette />
            <ShortcutFeedback />
            <ExposureSettingsWidget />

        </Container>
    );
};

export default CanvasPage;
