import { cn } from '@heroui/react';
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import type { CSSProperties, RefObject } from 'react';
import type { FractalSceneRef } from '@/modules/fractal/components/organisms/FractalScene';



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

    const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
    const [analysisDiscoveryTourActive, setAnalysisDiscoveryTourActive] = useState(false);

    useCanvasScrollLock(isNarrowViewport && !isLocalGlbViewer);

    useEffect(() => {
        if (!isNarrowViewport) {
            setRightDrawerOpen(false);
        }
    }, [isNarrowViewport]);

    useEffect(() => {
        if (activeWorkspace === CanvasWorkspace.Scene) {
            return;
        }

        if (!isLocalGlbViewer) {
            return;
        }

        setActiveWorkspace(CanvasWorkspace.Scene, { replace: true });
    }, [activeWorkspace, isLocalGlbViewer, setActiveWorkspace]);

    useEffect(() => {
        const editorState = useEditorStore.getState();
        editorState.resetPlayback();
        editorState.resetModel();
    }, [trajectoryId]);

    const hasFrames = Boolean(trajectory?.frames.length);
    const trajectoryMissing = Boolean(!trajectoryLoading && trajectoryError && !trajectory && trajectoryId);
    const showNoFramesState = Boolean(
        !isLocalGlbViewer
        && !isRasterWorkspace
        && trajectory
        && !hasFrames
    );
    const isSceneSubstituted = isRasterWorkspace || showNoFramesState;
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

    /*
     * The panel's width is an inline style driven by this hook, so a utility class on the
     * element would just be overridden — this default is the only place the docked width
     * can be set.
     *
     * This only governs viewports wider than the narrow breakpoint (1199px). Below it the
     * panel becomes an overlay drawer whose width is pinned by an `!important` utility in
     * CanvasRightPanelRegion, which beats this inline style; both have to move together
     * for a width change to be visible on a laptop-sized window.
     *
     * The storage key carries a version suffix because a persisted size shadows the
     * default: anyone who had ever dragged the divider would keep their old width and
     * never see this one. Bumping the suffix discards those saved widths, which is the
     * intended reset.
     */
    const rightPanel = useResizable({
        direction: ResizeDirection.Horizontal,
        initialSize: 400,
        minSize: 200,
        maxSize: 460,
        growPositive: false,
        storageKey: 'volt:canvas:right-panel-size:v4'
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
            onDownloadAnalysis={openAnalysisDownloadModal}
        />
    ), [canDownloadAnalysisListing, isDownloading, openAnalysisDownloadModal]);

    const viewportBodyContent = useViewportBodyContent({
        trajectory,
        trajectoryId,
        currentTimestep,
        isRasterWorkspace,
        isLocalGlbViewer,
        isLocalManifestLoading: localGlbViewer.isManifestLoading,
        localManifestError: localGlbViewer.manifestError,
        forcedGlbUrl: localGlbViewer.forcedGlbUrl,
        showNoFramesState,
        rasterContainerSelections: raster.selections,
        onUpdateRasterContainerSelection: raster.updateSelection
    });

    const analysisOverlay = useMemo(() => (
        showsTrajectoryScene
            ? <AnalysisExecutionOverlay trajectory={trajectory} analysisId={analysisId} currentTimestep={currentTimestep} />
            : undefined
    ), [showsTrajectoryScene, trajectory, analysisId, currentTimestep]);

    if (accessDenied || trajectoryMissing) {
        return (
            <div className={cn('flex w-screen h-dvh bg-background text-foreground', 'canvas-editor-root', '[--canvas-header-height:55px] max-md:[--canvas-header-height:40px] max-md:[--canvas-mobile-panel-edge:0.75rem] max-md:[--canvas-mobile-panel-top:calc(var(--canvas-header-height,40px)_+_8.75rem)] max-md:[--canvas-mobile-controls-gutter:5rem] max-md:[--canvas-mobile-control-column-size:2.625rem] max-md:[--canvas-mobile-control-column-right:calc(0.5rem_+_env(safe-area-inset-right,0px))] max-md:[--canvas-mobile-drawer-trigger-top:calc(1rem_+_env(safe-area-inset-top,0px))] max-md:[--canvas-mobile-viewport-controls-top:calc(var(--canvas-mobile-drawer-trigger-top)_+_var(--canvas-mobile-control-column-size)_+_0.5rem)]')}>
                {accessDenied
                    ? (
                        <AccessDenied
                            title={accessDeniedMessage ?? 'Access denied'}
                            description='You do not have permission to view this trajectory. Ask a team administrator to grant you access.'
                        />
                    )
                    : <NotFoundState />}
            </div>
        );
    }

    const rightOverlaySize = !isLocalGlbViewer && !isNarrowViewport ? rightPanel.size : 0;

    return (
        <div className={cn('flex relative overflow-hidden w-screen h-dvh bg-background text-foreground', '[--canvas-header-height:55px] max-md:[--canvas-header-height:40px] max-md:[--canvas-mobile-panel-edge:0.75rem] max-md:[--canvas-mobile-panel-top:calc(var(--canvas-header-height,40px)_+_8.75rem)] max-md:[--canvas-mobile-controls-gutter:5rem] max-md:[--canvas-mobile-control-column-size:2.625rem] max-md:[--canvas-mobile-control-column-right:calc(0.5rem_+_env(safe-area-inset-right,0px))] max-md:[--canvas-mobile-drawer-trigger-top:calc(1rem_+_env(safe-area-inset-top,0px))] max-md:[--canvas-mobile-viewport-controls-top:calc(var(--canvas-mobile-drawer-trigger-top)_+_var(--canvas-mobile-control-column-size)_+_0.5rem)]', `canvas-editor-root${isNarrowViewport ? ' canvas-editor-root--narrow' : ''}${isReadOnlyCanvas ? ' canvas-editor-root--read-only' : ''}`)}
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
                    className='absolute inset-0 z-[4] cursor-pointer border-none p-0 bg-[color-mix(in_srgb,var(--overlay)_55%,transparent)] backdrop-blur-[6px] backdrop-saturate-[1.3] animate-[canvas-drawer-backdrop-in_180ms_ease-out] max-md:z-[130] max-md:bg-transparent max-md:backdrop-filter-none'
                    aria-label='Close panel'
                    onClick={closeRightDrawer}
                />
            )}

            <div className='flex flex-col relative overflow-hidden flex-1 min-h-0 canvas-editor-main'>
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

                <div className='flex flex-col relative overflow-hidden flex-1 min-h-0 canvas-editor-stage'>
                    <div className='flex flex-col absolute overflow-hidden inset-0 canvas-center-viewport' ref={viewportContainerRef as RefObject<HTMLDivElement>}>
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
                    </div>

                    {!isLocalGlbViewer && (
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
                </div>

                {!isLocalGlbViewer && showStatusBar && (
                    <StatusBar
                        trajectory={trajectory}
                        currentTimestep={currentTimestep}
                    />
                )}
            </div>

            {!isLocalGlbViewer && (
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
        </div>
    );
};

export default CanvasPage;
