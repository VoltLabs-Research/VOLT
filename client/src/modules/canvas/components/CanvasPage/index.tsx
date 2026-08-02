import { useKeyboardShortcutsStore } from '../../store/use-keyboard-shortcuts-store';
import { useEditorStore } from '@/modules/canvas/store/editor';
import useCanvasCleanup from '../../hooks/use-canvas-cleanup';
import useCanvasCoordinator from '../../hooks/use-canvas-coordinator';
import useCanvasUrlState, { CanvasWorkspace } from '../../hooks/use-canvas-url-state';
import useFractalSceneConfig from '@/modules/canvas/hooks/use-fractal-scene-config';
import useKeyboardShortcuts from '../../hooks/use-keyboard-shortcuts';
import useResizable, { ResizeDirection } from '../../hooks/use-resizable';
import useViewportNarrow from '../../hooks/use-viewport-narrow';

import useAnalysisDiscoveryTourGate from './use-analysis-discovery-tour-gate';
import useCanvasAccessPublication from './use-canvas-access-publication';
import useCanvasBridgeRegistration from './use-canvas-bridge-registration';
import useCanvasCollaboration from './use-canvas-collaboration';
import useCanvasDownloads from './use-canvas-downloads';
import useCanvasScrollLock from './use-canvas-scroll-lock';
import useLocalGlbViewer from './use-local-glb-viewer';
import useRasterContainerSelections from './use-raster-container-selections';
import useTrajectoryShareInfo from './use-trajectory-share-info';
import useViewportBodyContent from './use-viewport-body-content';
import CanvasRightPanelRegion from './CanvasRightPanelRegion';
import CanvasTimelineDock from './CanvasTimelineDock';
import CanvasToolbarActions from './CanvasToolbarActions';
import LocalViewerFrameControls from './LocalViewerFrameControls';

import AnalysisExecutionOverlay from '../AnalysisExecutionOverlay';
import AnalysisListingDownloadModal from '../AnalysisListingDownloadModal';
import CanvasAnalysisDiscoveryTour from '../CanvasAnalysisDiscoveryTour';
import CanvasBanners from '../CanvasBanners';
import CommandPalette from '../CommandPalette';
import ExposureSettingsWidget from '../ExposureSettingsWidget';
import PluginResultsViewer from '../PluginResultsViewer';
import PreloadingOverlay from '../PreloadingOverlay';
import ShortcutFeedback from '../ShortcutFeedback';
import StatusBar from '../StatusBar';
import TopToolbar from '../TopToolbar';
import Viewport from '../Viewport';
import WorkspaceCursorsOverlay from '../WorkspaceCursorsOverlay';

import AccessDenied from '@/shared/ui/components/AccessDenied';
import ErrorBoundary from '@/shared/ui/components/ErrorBoundary';
import NotFoundState from '@/shared/ui/components/NotFoundState';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import useTip from '@/shared/tips/use-tip';
import { Box, Stack } from '@voltstack/bravais';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import type { CSSProperties, RefObject } from 'react';
import type { FractalSceneRef } from '@/modules/fractal/components/organisms/FractalScene';

import './CanvasPage.css';

const CanvasPage = () => {
    usePageTitle('Canvas');
    const { trajectoryId: routeTrajectoryId, ownerId: ownerIdParam } = useParams<{ trajectoryId?: string; ownerId?: string }>();
    const trajectoryId = routeTrajectoryId ?? '';
    const isLocalGlbViewer = !routeTrajectoryId;

    useCanvasCleanup();
    const {
        trajectory,
        availableTimesteps,
        selectedAnalysisTimesteps,
        currentTimestep,
        isLoading: trajectoryLoading,
        analyses,
        isAnalysesLoading,
        error: trajectoryError,
        access: canvasAccess,
        accessDenied,
        accessDeniedMessage
    } = useCanvasCoordinator({ trajectoryId });

    const {
        canCollaborate,
        hasResolvedAccess,
        canMutateCanvas,
        isReadOnlyCanvas
    } = useCanvasAccessPublication({
        trajectoryId,
        access: canvasAccess,
        isLocalGlbViewer
    });

    const viewportContainerRef = useRef<HTMLDivElement | null>(null);
    const isNarrowViewport = useViewportNarrow();
    const {
        peersInLobby,
        collaborationOwner,
        ownerId: workspaceOwnerId,
        isOwner: isWorkspaceOwner,
        cursors: workspaceCursors,
        navigateToWorkspace,
        leaveCollaboration
    } = useCanvasCollaboration({
        trajectoryId,
        ownerId: ownerIdParam,
        enabled: canCollaborate,
        containerRef: viewportContainerRef
    });

    useTip('canvas-shortcuts', {
        enabled: Boolean(trajectoryId) && !trajectoryLoading && !isNarrowViewport
    });

    useKeyboardShortcuts({
        trajectoryId,
        availableTimesteps,
        currentTimestep
    });
    const setCurrentScope = useKeyboardShortcutsStore((s) => s.setCurrentScope);
    const currentScope = useKeyboardShortcutsStore((s) => s.currentScope);

    useEffect(() => {
        if (currentScope !== 'canvas') {
            setCurrentScope('canvas');
        }
    }, [currentScope, setCurrentScope]);

    const { isModelLoading, didPreload, isPlaying, isPreloading, preloadProgress } = useEditorStore(useShallow((s) => ({
        isModelLoading: s.isModelLoading,
        didPreload: s.didPreload,
        isPlaying: s.isPlaying,
        isPreloading: s.isPreloading,
        preloadProgress: s.preloadProgress
    })));

    const sceneConfig = useFractalSceneConfig();
    const sceneRef = useRef<FractalSceneRef>(null);

    useCanvasBridgeRegistration({
        trajectoryId,
        timesteps: availableTimesteps,
        currentTimestep,
        sceneRef
    });

    const {
        analysisId,
        showGrid,
        showGizmo,
        resultsPluginId,
        showWidgets,
        searchParams,
        activeWorkspace,
        setActiveWorkspace
    } = useCanvasUrlState();
    const showStatusBar = searchParams.get('statusBar') !== 'false';
    const isRasterWorkspace = !isLocalGlbViewer && activeWorkspace === CanvasWorkspace.Raster;
    const isScriptingWorkspace = !isLocalGlbViewer && canMutateCanvas && activeWorkspace === CanvasWorkspace.Scripting;

    const localGlbViewer = useLocalGlbViewer(isLocalGlbViewer);
    const raster = useRasterContainerSelections();
    const {
        isDownloading,
        downloadListing,
        downloadAnalysisListings,
        analysisDownloadTargetId,
        openAnalysisDownloadModal,
        closeAnalysisDownloadModal,
        downloadAllTrajectoryAnalyses,
        canDownloadAnalysisListing,
        canDownloadTrajectoryAnalyses
    } = useCanvasDownloads({
        trajectory,
        analysisId
    });

    const [scriptingJupyterUrl, setScriptingJupyterUrl] = useState<string | null>(null);
    const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
    const [analysisDiscoveryTourActive, setAnalysisDiscoveryTourActive] = useState(false);

    useCanvasScrollLock(isNarrowViewport && !isLocalGlbViewer);

    useEffect(() => {
        if (!isNarrowViewport || isScriptingWorkspace) {
            setRightDrawerOpen(false);
        }
    }, [isNarrowViewport, isScriptingWorkspace]);

    useEffect(() => {
        if (activeWorkspace === CanvasWorkspace.Scene) {
            return;
        }

        const isWorkspaceUnavailable = isLocalGlbViewer
            || (activeWorkspace === CanvasWorkspace.Scripting && hasResolvedAccess && !canMutateCanvas);
        if (!isWorkspaceUnavailable) {
            return;
        }

        setActiveWorkspace(CanvasWorkspace.Scene, { replace: true });
    }, [activeWorkspace, canMutateCanvas, hasResolvedAccess, isLocalGlbViewer, setActiveWorkspace]);

    useEffect(() => {
        const editorState = useEditorStore.getState();
        editorState.resetPlayback();
        editorState.resetModel();
    }, [trajectoryId]);

    const hasFrames = Boolean(trajectory?.frames.length);
    const trajectoryMissing = Boolean(!trajectoryLoading && trajectoryError && !trajectory && trajectoryId);
    const showNoFramesState = Boolean(
        !isLocalGlbViewer
        && !isScriptingWorkspace
        && !isRasterWorkspace
        && trajectory
        && !hasFrames
    );
    const isSceneSubstituted = isScriptingWorkspace || isRasterWorkspace || showNoFramesState;
    const showsTrajectoryScene = !isLocalGlbViewer && !isSceneSubstituted;
    const isTrajectoryLoading = trajectoryLoading
        || !trajectory
        || (hasFrames && ((isModelLoading && !(didPreload && isPlaying)) || currentTimestep === undefined));
    const overlayActive = Boolean(
        !isLocalGlbViewer
        && !showNoFramesState
        && (isTrajectoryLoading || isPreloading)
        && !analysisDiscoveryTourActive
    );

    const rightPanel = useResizable({
        direction: ResizeDirection.Horizontal,
        initialSize: 268,
        minSize: 200,
        maxSize: 420,
        growPositive: false,
        storageKey: 'volt:canvas:right-panel-size'
    });

    const timelinePanel = useResizable({
        direction: ResizeDirection.Vertical,
        initialSize: 192,
        minSize: 120,
        maxSize: 600,
        growPositive: false,
        storageKey: 'volt:canvas:timeline-panel-size'
    });

    const closeRightDrawer = useCallback(() => {
        setRightDrawerOpen(false);
    }, []);

    const shareInfo = useTrajectoryShareInfo(trajectory);

    const analysisDiscoveryTour = useAnalysisDiscoveryTourGate({
        analyses,
        isAnalysesLoading,
        isSceneInteractive: showsTrajectoryScene && !overlayActive && Boolean(trajectory?._id)
    });

    const toolbarContextualActions = useMemo(() => (
        <CanvasToolbarActions
            canDownloadAnalysis={canDownloadAnalysisListing}
            isDownloadingAnalysis={isDownloading}
            jupyterUrl={isScriptingWorkspace ? scriptingJupyterUrl : null}
            onDownloadAnalysis={openAnalysisDownloadModal}
        />
    ), [canDownloadAnalysisListing, isDownloading, isScriptingWorkspace, openAnalysisDownloadModal, scriptingJupyterUrl]);

    const viewportBodyContent = useViewportBodyContent({
        trajectory,
        trajectoryId,
        currentTimestep,
        isRasterWorkspace,
        isScriptingWorkspace,
        isLocalGlbViewer,
        isLocalManifestLoading: localGlbViewer.isManifestLoading,
        localManifestError: localGlbViewer.manifestError,
        forcedGlbUrl: localGlbViewer.forcedGlbUrl,
        showNoFramesState,
        rasterContainerSelections: raster.selections,
        onUpdateRasterContainerSelection: raster.updateSelection,
        onJupyterUrlChange: setScriptingJupyterUrl
    });

    const analysisOverlay = useMemo(() => (
        showsTrajectoryScene
            ? <AnalysisExecutionOverlay trajectory={trajectory} analysisId={analysisId} currentTimestep={currentTimestep} />
            : undefined
    ), [showsTrajectoryScene, trajectory, analysisId, currentTimestep]);

    if (accessDenied || trajectoryMissing) {
        return (
            <Box display='flex' height='vh-max' width='vw-max' className='canvas-editor-root'>
                {accessDenied
                    ? (
                        <AccessDenied
                            title={accessDeniedMessage ?? 'Access denied'}
                            description='You do not have permission to view this trajectory. Ask a team administrator to grant you access.'
                        />
                    )
                    : <NotFoundState />}
            </Box>
        );
    }

    const rightOverlaySize = !isLocalGlbViewer && !isNarrowViewport && !isScriptingWorkspace ? rightPanel.size : 0;

    return (
        <Box
            display='flex'
            height='vh-max'
            width='vw-max'
            overflow='hidden'
            position='relative'
            className={`canvas-editor-root${isNarrowViewport ? ' canvas-editor-root--narrow' : ''}${isReadOnlyCanvas ? ' canvas-editor-root--read-only' : ''}`}
            style={{ '--canvas-right-overlay-size': `${rightOverlaySize}px` } as CSSProperties}
        >
            <PreloadingOverlay
                active={overlayActive}
                title={isPreloading ? 'Setting up your scene…' : 'Loading trajectory…'}
                progress={isPreloading ? preloadProgress : undefined}
            />

            {isNarrowViewport && rightDrawerOpen && (
                <button
                    type='button'
                    className='canvas-panel-drawer-backdrop'
                    aria-label='Close panel'
                    onClick={closeRightDrawer}
                />
            )}

            <Stack flex='1' overflow='hidden' position='relative' minH='0' className="canvas-editor-main">
                <TopToolbar
                    trajectory={trajectory}
                    canDownloadAnalyses={canDownloadTrajectoryAnalyses}
                    onDownloadAnalyses={downloadAllTrajectoryAnalyses}
                    localGlbMode={isLocalGlbViewer}
                    canMutateCanvas={canMutateCanvas}
                    workspacePeers={peersInLobby}
                    workspaceActiveOwnerId={workspaceOwnerId}
                    onSelectWorkspacePeer={navigateToWorkspace}
                    share={shareInfo}
                    contextualActions={toolbarContextualActions}
                />

                {!isLocalGlbViewer && (
                    <CanvasBanners
                        collaborationOwner={collaborationOwner}
                        isWorkspaceOwner={isWorkspaceOwner}
                        onLeaveCollaboration={leaveCollaboration}
                    />
                )}

                <Stack flex='1' overflow='hidden' position='relative' minH='0' className="canvas-editor-stage">
                    <Box display='flex' direction='column' position='absolute' inset='0' overflow='hidden' className="canvas-center-viewport" ref={viewportContainerRef as RefObject<HTMLDivElement>}>
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
                                forcedGlbUrl={localGlbViewer.forcedGlbUrl}
                                showGrid={showGrid}
                                showGizmo={showGizmo}
                                sceneRef={sceneRef}
                                bodyContent={viewportBodyContent}
                                analysisOverlay={analysisOverlay}
                                hideGradient={isSceneSubstituted}
                                renderScene={!isSceneSubstituted}
                                showSceneActions={!isSceneSubstituted}
                            />
                        </ErrorBoundary>
                        <WorkspaceCursorsOverlay
                            cursors={workspaceCursors}
                            containerRef={viewportContainerRef}
                        />
                    </Box>

                    {!isLocalGlbViewer && !isScriptingWorkspace && (
                        <CanvasTimelineDock
                            panel={timelinePanel}
                            isNarrowViewport={isNarrowViewport}
                            sceneRef={sceneRef}
                            trajectory={trajectory}
                            trajectoryId={trajectoryId}
                            currentTimestep={currentTimestep}
                            availableTimesteps={availableTimesteps}
                            selectedAnalysisTimesteps={selectedAnalysisTimesteps}
                            analysisId={analysisId}
                            onDownloadExposureListing={downloadListing}
                        />
                    )}
                    {isLocalGlbViewer && (
                        <LocalViewerFrameControls
                            manifest={localGlbViewer.manifest}
                            frame={localGlbViewer.frame}
                            frameIndex={localGlbViewer.frameIndex}
                            onSelectFrame={localGlbViewer.setFrameIndex}
                        />
                    )}
                </Stack>

                {!isLocalGlbViewer && showStatusBar && (
                    <StatusBar
                        trajectory={trajectory}
                        currentTimestep={currentTimestep}
                        analysisId={analysisId}
                    />
                )}
            </Stack>

            {!isLocalGlbViewer && !isScriptingWorkspace && (
                <CanvasRightPanelRegion
                    panel={rightPanel}
                    isNarrowViewport={isNarrowViewport}
                    isDrawerOpen={rightDrawerOpen}
                    onDrawerOpenChange={setRightDrawerOpen}
                    trajectory={trajectory}
                    trajectoryId={trajectoryId}
                    analysisId={analysisId}
                    currentTimestep={currentTimestep}
                    canMutateCanvas={canMutateCanvas}
                    onDownloadAnalysis={openAnalysisDownloadModal}
                    onDownloadExposureListing={downloadListing}
                    rasterContainerSelections={raster.selections}
                    activeRasterContainerId={raster.activeContainerId}
                    onSetActiveRasterContainer={raster.setActiveContainerId}
                    onUpdateRasterContainerSelection={raster.updateSelection}
                />
            )}
            {!isLocalGlbViewer && showWidgets && resultsPluginId && analysisId && (
                <PluginResultsViewer
                    pluginId={resultsPluginId}
                    analysisId={analysisId}
                />
            )}
            <AnalysisListingDownloadModal
                analysisId={analysisDownloadTargetId}
                isDownloading={isDownloading}
                onDownload={downloadAnalysisListings}
                onClose={closeAnalysisDownloadModal}
            />
            <CommandPalette />
            <ShortcutFeedback />
            <ExposureSettingsWidget />
            <CanvasAnalysisDiscoveryTour
                enabled={analysisDiscoveryTour.enabled}
                storageScopeId={analysisDiscoveryTour.storageScopeId}
                isMobile={isNarrowViewport}
                rightDrawerOpen={rightDrawerOpen}
                onRightDrawerOpenChange={setRightDrawerOpen}
                onActiveChange={setAnalysisDiscoveryTourActive}
                onComplete={closeRightDrawer}
            />

        </Box>
    );
};

export default CanvasPage;
