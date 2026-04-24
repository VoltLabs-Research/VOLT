import { useKeyboardShortcutsStore } from '../../stores/use-keyboard-shortcuts-store';
import { findCachedAnalysisById } from '@/modules/analysis/services/cache';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { CanvasWorkspace } from '@/modules/canvas/hooks/use-canvas-url-state';
import useAnalysisStatus from '../../hooks/use-analysis-status';
import { CanvasAnalysisStatusEnum, normalizeCanvasAnalysisStatus } from '../../utilities/analysis-status';
import useCanvasCleanup from '../../hooks/use-canvas-cleanup';
import useCanvasCoordinator from '../../hooks/use-canvas-coordinator';
import useCanvasUrlState from '../../hooks/use-canvas-url-state';
import useCanvasWorkspace from '@/modules/canvas/collaboration/use-canvas-workspace';
import useLiveModelDrag from '@/modules/canvas/collaboration/use-live-model-drag';
import useWorkspaceCursors from '@/modules/canvas/collaboration/use-workspace-cursors';
import WorkspaceCursorsOverlay from '../WorkspaceCursorsOverlay';
import { useLocalGlbStore } from '@/modules/canvas/stores/use-local-glb-store';
import useDownloadPluginListing from '../../hooks/use-download-plugin-listing';
import useKeyboardShortcuts from '../../hooks/use-keyboard-shortcuts';
import useResizable from '../../hooks/use-resizable';
import useViewportNarrow from '../../hooks/use-viewport-narrow';
import useDownloadTrajectoryAnalyses from '@/modules/trajectory/hooks/trajectory/use-download-trajectory-analyses';
import useDownloadTrajectory from '@/modules/trajectory/hooks/trajectory/use-download-trajectory';
import CanvasBanners from '../CanvasBanners';
import PreloadingOverlay from '../PreloadingOverlay';
import ResizeHandle from '../ResizeHandle';
import ExposureSettingsWidget from '../ExposureSettingsWidget';
import ShortcutFeedback from '../ShortcutFeedback';
import AnalysisListingDownloadModal, {
    ANALYSIS_LISTING_DOWNLOAD_MODAL_ID
} from '../AnalysisListingDownloadModal';
import CommandPalette from '../CommandPalette';
import KeyboardShortcutsPanel from '../KeyboardShortcutsPanel';
import PluginResultsViewer from '../PluginResultsViewer';
import RightPanel from '../RightPanel';
import StatusBar from '../StatusBar';
import Timeline from '../Timeline';
import TopToolbar from '../TopToolbar';
import Viewport from '../Viewport';
import useFractalSceneConfig from '@/modules/canvas/hooks/use-fractal-scene-config';
import CanvasRasterViewport from '@/modules/raster/components/CanvasRasterViewport';
import { ResizeDirection } from '@/modules/canvas/hooks/use-resizable';

import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useCanvasAccessStore, useCanvasCanCollaborate } from '@/modules/canvas/api/access';
import { Download, ExternalLink, PanelRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import ScriptingWorkspace from '@/modules/scripting/components/ScriptingWorkspace';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import NotFoundState from '@/shared/presentation/components/NotFoundState';
import EmptyState from '@/shared/presentation/primitives/EmptyState';
import ErrorBoundary from '@/shared/presentation/components/ErrorBoundary';
import Box from '@/shared/presentation/primitives/Box';
import Button from '@/shared/presentation/primitives/Button';
import { openModal } from '@/shared/presentation/primitives/Modal';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Tooltip from '@/shared/presentation/primitives/Tooltip';
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
    const effectiveTrajectoryId = rawTrajectoryId;
    const trajectoryId = effectiveTrajectoryId ?? '';
    const isLocalGlbViewer = !effectiveTrajectoryId;

    useCanvasCleanup();
    const {
        trajectory,
        availableTimesteps,
        currentTimestep,
        isLoading: trajectoryLoading,
        error: trajectoryError,
        access: canvasAccess,
        accessDenied,
        accessDeniedMessage
    } = useCanvasCoordinator({ trajectoryId });

    const setCanvasAccess = useCanvasAccessStore((state) => state.setAccess);
    const resetCanvasAccess = useCanvasAccessStore((state) => state.reset);

    useEffect(() => {
        if (!canvasAccess || !trajectoryId) {
            return;
        }

        const mode = canvasAccess.hasTeamMembership ? 'rbac' : 'public';
        const canMutate = canvasAccess.hasTeamMembership;

        setCanvasAccess({
            mode,
            trajectoryId,
            teamId: undefined,
            canMutate,
            canCollaborate: canMutate,
            isGuest: !canvasAccess.hasTeamMembership,
            hasTeamMembership: canvasAccess.hasTeamMembership
        });
    }, [canvasAccess, trajectoryId, setCanvasAccess]);

    useEffect(() => {
        return () => {
            resetCanvasAccess();
        };
    }, [resetCanvasAccess]);
    const viewportContainerRef = useRef<HTMLDivElement | null>(null);
    const canCollaborate = useCanvasCanCollaborate();
    const {
        peersInLobby,
        collaborationOwner,
        ownerId: workspaceOwnerId,
        isOwner: isWorkspaceOwner,
        navigateToWorkspace
    } = useCanvasWorkspace({
        trajectoryId,
        ownerId: ownerIdParam,
        enabled: !!trajectoryId && canCollaborate
    });
    const navigate = useNavigate();
    const leaveCollaboration = useCallback(() => {
        if (!trajectoryId) return;
        navigate(`/canvas/${trajectoryId}`, { replace: true });
    }, [navigate, trajectoryId]);
    const { cursors: workspaceCursors } = useWorkspaceCursors({
        trajectoryId,
        ownerId: workspaceOwnerId,
        enabled: !!trajectoryId && !!workspaceOwnerId && canCollaborate,
        containerRef: viewportContainerRef
    });
    useLiveModelDrag({
        trajectoryId,
        ownerId: workspaceOwnerId,
        isOwner: isWorkspaceOwner,
        enabled: !!trajectoryId && !!workspaceOwnerId && canCollaborate
    });
    useTip('canvas-shortcuts', {
        enabled: Boolean(trajectoryId) && !trajectoryLoading
    });

    useKeyboardShortcuts({ trajectoryId, availableTimesteps, currentTimestep });
    const setCurrentScope = useKeyboardShortcutsStore((s) => s.setCurrentScope);

    useEffect(() => {
        setCurrentScope('canvas');
    }, [setCurrentScope]);

    const { isModelLoading, didPreload, isPlaying, isPreloading, preloadProgress } = useEditorStore(useShallow((s) => ({
        isModelLoading: s.isModelLoading,
        didPreload: s.didPreload,
        isPlaying: s.isPlaying,
        isPreloading: s.isPreloading,
        preloadProgress: s.preloadProgress
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
    const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

    useEffect(() => {
        if (!isNarrowViewport || isScriptingWorkspace) {
            setRightDrawerOpen(false);
        }
    }, [isNarrowViewport, isScriptingWorkspace]);

    useEffect(() => {
        if (!isLocalGlbViewer) {
            return;
        }

        setActiveWorkspace(CanvasWorkspace.Scene, { replace: true });
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

    const hasFrames = !!(trajectory?.frames && trajectory.frames.length > 0);
    const trajectoryMissing = Boolean(!trajectoryLoading && trajectoryError && !trajectory && trajectoryId);
    const showNoFramesState = Boolean(
        !isLocalGlbViewer
        && !isScriptingWorkspace
        && !isRasterWorkspace
        && trajectory
        && !hasFrames
    );
    const showLoading = useMemo(() =>
        isLocalGlbViewer
            ? false
            : trajectoryLoading || !trajectory || (hasFrames && ((isModelLoading && !(didPreload && isPlaying)) || currentTimestep === undefined)),
        [isLocalGlbViewer, isModelLoading, didPreload, isPlaying, trajectory, hasFrames, currentTimestep, trajectoryLoading]
    );
    const overlayActive = !isLocalGlbViewer && !showNoFramesState && (showLoading || isPreloading);
    const overlayTitle = isPreloading ? 'Setting up your scene…' : 'Loading trajectory…';
    const overlayProgress = isPreloading ? preloadProgress : undefined;

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

    const toolbarContextualActions = (canDownloadAnalysisListing || scriptingHeaderAction)
        ? (
            <Row gap='05'>
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
            </Row>
        )
        : null;

    const viewportBodyContent = (() => {
        if (isRasterWorkspace) {
            return (
                <CanvasRasterViewport
                    trajectoryId={trajectoryId}
                    trajectory={trajectory}
                    currentTimestep={currentTimestep}
                    containerSelections={rasterContainerSelections}
                    onUpdateContainerSelection={handleUpdateRasterContainerSelection}
                />
            );
        }

        if (isScriptingWorkspace) {
            return (
                <ScriptingWorkspace
                    trajectoryId={trajectoryId}
                    notebookId={selectedNotebookId}
                    onJupyterUrlChange={setScriptingJupyterUrl}
                />
            );
        }

        if (isLocalGlbViewer && !forcedGlbUrl) {
            return (
                <Row justify='center' width='max' height='max'>
                    <EmptyState
                        title='Drop a GLB file to preview'
                        description='Use the global dashboard dropzone to open a local GLB viewer.'
                    />
                </Row>
            );
        }

        if (showNoFramesState) {
            return (
                <Row justify='center' width='max' height='max' className='canvas-viewport-state'>
                    <EmptyState
                        title='No timesteps yet'
                        description='This trajectory finished uploading but has no timesteps processed yet. Once ingestion completes they will appear here automatically.'
                    />
                </Row>
            );
        }

        return undefined;
    })();

    const rightOverlaySize = !isLocalGlbViewer && !isNarrowViewport && !isScriptingWorkspace ? rightPanel.size : 0;

    if (accessDenied) {
        return (
            <Box display='flex' height='vh-max' width='vw-max' className='canvas-editor-root'>
                <AccessDenied
                    title={accessDeniedMessage ?? 'Access denied'}
                    description='You do not have permission to view this trajectory. Ask a team administrator to grant you access.'
                />
            </Box>
        );
    }

    if (trajectoryMissing) {
        return (
            <Box display='flex' height='vh-max' width='vw-max' className='canvas-editor-root'>
                <NotFoundState />
            </Box>
        );
    }

    const isGuest = !isLocalGlbViewer && canvasAccess ? !canvasAccess.hasTeamMembership : false;

    return (
        <Box
            display='flex'
            height='vh-max'
            width='vw-max'
            overflow='hidden'
            position='relative'
            className={`canvas-editor-root${isNarrowViewport ? ' canvas-editor-root--narrow' : ''}`}
            style={{ '--canvas-right-overlay-size': `${rightOverlaySize}px` } as React.CSSProperties}
        >
            <PreloadingOverlay
                active={Boolean(overlayActive)}
                title={overlayTitle}
                progress={overlayProgress}
            />

            {isNarrowViewport && rightDrawerOpen && (
                <button
                    type='button'
                    className='canvas-panel-drawer-backdrop'
                    aria-label='Close panel'
                    onClick={() => setRightDrawerOpen(false)}
                />
            )}

            <Stack flex='1' overflow='hidden' position='relative' minH='0' className="canvas-editor-main">
                <TopToolbar
                    trajectory={trajectory}
                    canExport={canExportTrajectory}
                    canDownloadAnalyses={canDownloadTrajectoryAnalyses}
                    onExport={handleExportTrajectory}
                    onDownloadAnalyses={handleDownloadTrajectoryAnalyses}
                    localGlbMode={isLocalGlbViewer}
                    workspacePeers={peersInLobby}
                    workspaceActiveOwnerId={workspaceOwnerId}
                    onSelectWorkspacePeer={navigateToWorkspace}
                    share={shareInfo}
                    contextualActions={toolbarContextualActions}
                />

                {!isLocalGlbViewer && (
                    <CanvasBanners
                        isGuest={isGuest}
                        isNarrowViewport={isNarrowViewport}
                        collaborationOwner={collaborationOwner}
                        isWorkspaceOwner={isWorkspaceOwner}
                        onLeaveCollaboration={leaveCollaboration}
                    />
                )}

                <Stack flex='1' overflow='hidden' position='relative' minH='0' className="canvas-editor-stage">
                    <Box display='flex' direction='column' position='absolute' inset='0' overflow='hidden' className="canvas-center-viewport" ref={viewportContainerRef as React.RefObject<HTMLDivElement>}>
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
                                sceneRef={sceneRef}
                                bodyContent={viewportBodyContent}
                                hideGradient={isScriptingWorkspace || isRasterWorkspace || showNoFramesState}
                                renderScene={!isScriptingWorkspace && !isRasterWorkspace && !showNoFramesState}
                                showSceneActions={!isRasterWorkspace && !isScriptingWorkspace && !showNoFramesState}
                            />
                        </ErrorBoundary>
                        <WorkspaceCursorsOverlay
                            cursors={workspaceCursors}
                            containerRef={viewportContainerRef}
                        />
                    </Box>

                    {!isLocalGlbViewer && !isScriptingWorkspace && (
                        <>
                            <div
                                className="canvas-resize-rail canvas-resize-rail--timeline p-absolute"
                                style={{ left: 0, right: rightOverlaySize, bottom: timeline.size }}
                            >
                                <ResizeHandle
                                    direction={ResizeDirection.Vertical}
                                    isDragging={timeline.isDragging}
                                    label="Resize timeline"
                                    controls="canvas-center-timeline"
                                    {...timeline.handleProps}
                                />
                            </div>
                            <Stack
                                id="canvas-center-timeline"
                                position='absolute'
                                shrink='0'
                                minH='0'
                                className="canvas-center-timeline canvas-overlay-glass"
                                style={{ height: timeline.size }}
                            >
                                <Timeline
                                    sceneRef={sceneRef}
                                    trajectory={trajectory}
                                    trajectoryId={trajectoryId}
                                    currentTimestep={currentTimestep}
                                    availableTimesteps={availableTimesteps}
                                    analysisId={analysisId}
                                    onTabChange={handleTimelineTabChange}
                                    onDownloadExposureListing={handleDownloadExposureListing}
                                />
                            </Stack>
                        </>
                    )}
                </Stack>

                {!isLocalGlbViewer && showStatusBar && (
                    <StatusBar trajectory={trajectory} currentTimestep={currentTimestep} />
                )}
            </Stack>

            {!isLocalGlbViewer && !isScriptingWorkspace && (
                <>
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
                    {!isNarrowViewport && (
                        <div
                            className="canvas-resize-rail canvas-resize-rail--right p-absolute"
                            style={{ top: 0, bottom: 0, right: rightPanel.size }}
                        >
                            <ResizeHandle
                                direction={ResizeDirection.Horizontal}
                                isDragging={rightPanel.isDragging}
                                label="Resize right sidebar"
                                controls="canvas-right-panel"
                                {...rightPanel.handleProps}
                            />
                        </div>
                    )}
                    <Stack
                        id="canvas-right-panel"
                        position='absolute'
                        className="canvas-right-panel-container canvas-overlay-glass"
                        style={{ width: rightPanel.size }}
                        data-drawer-open={isNarrowViewport ? (rightDrawerOpen ? 'true' : 'false') : undefined}
                    >
                        <RightPanel
                            trajectory={trajectory}
                            trajectoryId={trajectoryId}
                            analysisId={analysisId}
                            currentTimestep={currentTimestep}
                            onDownloadAnalysis={handleDownloadAnalysisListing}
                            onDownloadExposureListing={handleDownloadExposureListing}
                            rasterContainerSelections={rasterContainerSelections}
                            activeRasterContainerId={activeRasterContainerId}
                            onSetActiveRasterContainer={setActiveRasterContainerId}
                            onUpdateRasterContainerSelection={handleUpdateRasterContainerSelection}
                        />
                    </Stack>
                </>
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

        </Box>
    );
};

export default CanvasPage;
