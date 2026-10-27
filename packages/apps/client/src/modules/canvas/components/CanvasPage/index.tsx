import { cn } from '@heroui/react';
import { useKeyboardShortcutsStore } from '../../store/use-keyboard-shortcuts-store';
import { useEditorStore } from '@/modules/canvas/store/editor';
import useCanvasCleanup from './use-canvas-cleanup';
import useCanvasCoordinator from './use-canvas-coordinator';
import useCanvasUrlState from '../../hooks/use-canvas-url-state';
import useFractalSceneConfig from './use-fractal-scene-config';
import useKeyboardShortcuts from './use-keyboard-shortcuts';
import useResizable, { ResizeDirection } from '../../hooks/use-resizable';
import { useMedia } from '@/shared/ui/hooks/use-media';

import useAnalysisDiscoveryTourGate from './use-analysis-discovery-tour-gate';
import useCanvasAccessPublication from './use-canvas-access-publication';
import useCanvasBridgeRegistration from './use-canvas-bridge-registration';
import useCanvasCollaboration from './use-canvas-collaboration';
import useCanvasDownloads from './use-canvas-downloads';
import useCanvasScrollLock from './use-canvas-scroll-lock';
import useLocalGlbViewer from './use-local-glb-viewer';
import useTrajectoryShareInfo from './use-trajectory-share-info';
import useViewportBodyContent from './use-viewport-body-content';
import CanvasRightPanelRegion from './CanvasRightPanelRegion';
import CanvasTimelineDock from './CanvasTimelineDock';
import CanvasToolbarActions from './CanvasToolbarActions';
import LocalViewerFrameControls from './LocalViewerFrameControls';

import CanvasAnalysisDiscoveryTour from '../CanvasAnalysisDiscoveryTour';
import CanvasBanners from '../CanvasBanners';
import CommandPalette from '../CommandPalette';
import ExposureSettingsWidget from '../ExposureSettingsWidget';
import PreloadingOverlay from '../PreloadingOverlay';
import StatusBar from '../StatusBar';
import TopToolbar from '../TopToolbar';
import ViewportGrid from '../ViewportGrid';
import WorkspaceCursorsOverlay from '../WorkspaceCursorsOverlay';

import AccessDenied from '@/shared/ui/components/AccessDenied';
import ErrorBoundary from '@/shared/ui/components/ErrorBoundary';
import NotFoundState from '@/shared/ui/components/NotFoundState';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import useTrajectoryFilePicker from '@/modules/trajectory/hooks/trajectory/use-trajectory-file-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import type { RefObject } from 'react';
import type { FractalSceneRef } from '@/modules/fractal/contracts/scene-ref';



// Layout variables shared by the canvas regions: the toolbar height, and on phones where the
// floating panel and its round trigger sit inside the viewport, under the toolbar.
const CANVAS_ROOT_VARS = [
    '[--canvas-header-height:55px] max-md:[--canvas-header-height:40px]',
    'max-md:[--canvas-mobile-control-top:calc(var(--canvas-header-height)_+_0.5rem)]',
    'max-md:[--canvas-mobile-control-size:2.625rem]',
    'max-md:[--canvas-mobile-control-right:calc(1rem_+_env(safe-area-inset-right,0px))]',
    'max-md:[--canvas-mobile-panel-top:calc(var(--canvas-header-height)_+_3.75rem)]',
    'max-md:[--canvas-mobile-panel-left:calc(1rem_+_env(safe-area-inset-left,0px))]'
].join(' ');

const CanvasPage = () => {
    usePageTitle('Canvas');
    const navigate = useNavigate();
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
        canMutateCanvas
    } = useCanvasAccessPublication({
        trajectoryId,
        access: canvasAccess,
        isLocalGlbViewer
    });

    const viewportContainerRef = useRef<HTMLDivElement | null>(null);
    const isNarrowViewport = useMedia('(max-width: 1199px)');
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

    const setCurrentScope = useKeyboardShortcutsStore((s) => s.setCurrentScope);
    const currentScope = useKeyboardShortcutsStore((s) => s.currentScope);

    useEffect(() => {
        if (currentScope !== 'canvas') {
            setCurrentScope('canvas');
        }
    }, [currentScope, setCurrentScope]);

    const { isModelLoading, didPreload, isPlaying } = useEditorStore(useShallow((s) => ({
        isModelLoading: s.isModelLoading,
        didPreload: s.didPreload,
        isPlaying: s.isPlaying
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
        searchParams,
    } = useCanvasUrlState();
    const showStatusBar = searchParams.get('statusBar') !== 'false';

    const localGlbViewer = useLocalGlbViewer(isLocalGlbViewer);
    const {
        downloadAllTrajectoryAnalyses,
        canDownloadAnalysisListing,
        canDownloadTrajectoryAnalyses
    } = useCanvasDownloads({
        trajectory,
        analysisId
    });

    const navigateToDashboard = useCallback(() => navigate('/dashboard'), [navigate]);
    const { fileInputRef, handlePickerChange, openFilePicker } = useTrajectoryFilePicker(navigateToDashboard);
    const [isGuidedTourRequested, setIsGuidedTourRequested] = useState(false);
    const startGuidedTour = useCallback(() => setIsGuidedTourRequested(true), []);

    useKeyboardShortcuts({
        trajectoryId,
        availableTimesteps,
        currentTimestep,
        onImport: canMutateCanvas ? openFilePicker : undefined,
        onDownloadAnalyses: canDownloadTrajectoryAnalyses ? downloadAllTrajectoryAnalyses : undefined,
        onStartGuidedTour: startGuidedTour
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
        const editorState = useEditorStore.getState();
        editorState.resetPlayback();
        editorState.resetModel();
    }, [trajectoryId]);

    const hasFrames = Boolean(trajectory?.frames.length);
    const trajectoryMissing = Boolean(!trajectoryLoading && trajectoryError && !trajectory && trajectoryId);
    const showNoFramesState = Boolean(
        !isLocalGlbViewer
        && trajectory
        && !hasFrames
    );
    const showsTrajectoryScene = !isLocalGlbViewer && !showNoFramesState;
    const isTrajectoryLoading = trajectoryLoading
        || !trajectory
        || (hasFrames && ((isModelLoading && !(didPreload && isPlaying)) || currentTimestep === undefined));
    // Caching frames for playback no longer covers the viewport; the transport and the timeline show it.
    const overlayActive = Boolean(
        !isLocalGlbViewer
        && !showNoFramesState
        && isTrajectoryLoading
        && !analysisDiscoveryTourActive
    );
    const loadingFrame = currentTimestep !== undefined
        ? trajectory?.frames.find((frame) => frame.timestep === currentTimestep)
        : undefined;
    const overlayTitle = loadingFrame ? `Loading timestep ${loadingFrame.timestep}` : 'Loading trajectory…';
    const overlayDetail = loadingFrame ? `${loadingFrame.natoms.toLocaleString()} atoms` : undefined;

    const rightPanel = useResizable({
        direction: ResizeDirection.Horizontal,
        initialSize: 320,
        minSize: 240,
        maxSize: 460,
        growPositive: false,
        storageKey: 'volt:canvas:right-panel-size:v5'
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
            analysisId={analysisId}
            canDownloadAnalysis={canDownloadAnalysisListing}
            share={shareInfo}
        />
    ), [analysisId, canDownloadAnalysisListing, shareInfo]);

    const viewportBodyContent = useViewportBodyContent({
        trajectory,
        isLocalGlbViewer,
        isLocalManifestLoading: localGlbViewer.isManifestLoading,
        localManifestError: localGlbViewer.manifestError,
        forcedGlbUrl: localGlbViewer.forcedGlbUrl,
        showNoFramesState,
    });

    if (accessDenied || trajectoryMissing) {
        return (
            <div className={cn('flex h-dvh w-screen bg-canvas text-foreground', CANVAS_ROOT_VARS)}>
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

    return (
        <div className={cn('relative flex h-dvh w-screen overflow-hidden bg-canvas text-foreground', CANVAS_ROOT_VARS)}>
            {isNarrowViewport && rightDrawerOpen && (
                <button
                    type='button'
                    className='absolute inset-0 z-[4] cursor-pointer border-none bg-canvas/55 p-0 animate-[canvas-drawer-backdrop-in_180ms_ease-out] max-md:z-[130] max-md:bg-transparent'
                    aria-label='Close panel'
                    onClick={closeRightDrawer}
                />
            )}

            <input
                ref={fileInputRef}
                type='file'
                multiple
                hidden
                onChange={handlePickerChange}
            />

            <div className='relative flex min-h-0 flex-1 flex-col overflow-hidden'>
                <TopToolbar
                    trajectory={trajectory}
                    canMutateCanvas={canMutateCanvas}
                    workspacePeers={peersInLobby}
                    workspaceActiveOwnerId={workspaceOwnerId}
                    onSelectWorkspacePeer={navigateToWorkspace}
                    contextualActions={toolbarContextualActions}
                />

                {!isLocalGlbViewer && (
                    <CanvasBanners
                        collaborationOwner={collaborationOwner}
                        isWorkspaceOwner={isWorkspaceOwner}
                        onLeaveCollaboration={leaveCollaboration}
                    />
                )}

                {/* The viewport is one rounded surface, painted in the scene's own clear colour so it
                    reads the same before WebGL draws. It isolates its stack: the timeline docked over
                    its bottom stays below the drawer, and nothing here may filter, fade or mask, or
                    the glass over the scene would stop seeing it. */}
                <div className='relative isolate mb-[max(0.5rem,env(safe-area-inset-bottom,0px))] ml-[max(0.5rem,env(safe-area-inset-left,0px))] flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white dark:bg-canvas max-md:mr-[max(0.5rem,env(safe-area-inset-right,0px))]'>
                    <div className='relative flex min-h-0 flex-1 flex-col overflow-hidden' ref={viewportContainerRef as RefObject<HTMLDivElement>}>
                        <ErrorBoundary
                            fallbackTitle='Viewport crashed'
                            fallbackDescription='The 3D viewport hit an unexpected error. Reset to recover without losing your trajectory data.'
                            onError={() => {
                                useEditorStore.getState().resetModel();
                            }}
                        >
                            <ViewportGrid
                                trajectory={trajectory}
                                currentTimestep={currentTimestep}
                                sceneConfig={sceneConfig}
                                analysisId={analysisId}
                                forcedGlbUrl={localGlbViewer.forcedGlbUrl}
                                showGrid={showGrid}
                                showGizmo={showGizmo}
                                sceneRef={sceneRef}
                                bodyContent={viewportBodyContent}
                                renderScene={!showNoFramesState}
                            />
                        </ErrorBoundary>
                        <WorkspaceCursorsOverlay
                            cursors={workspaceCursors}
                            containerRef={viewportContainerRef}
                        />
                    </div>

                    {!isLocalGlbViewer && !showNoFramesState && (
                        <PreloadingOverlay
                            active={overlayActive}
                            title={overlayTitle}
                            detail={overlayDetail}
                        />
                    )}

                    {!isLocalGlbViewer && (
                        <CanvasTimelineDock
                            panel={timelinePanel}
                            isNarrowViewport={isNarrowViewport}
                            statusBar={showStatusBar ? (
                                <StatusBar trajectory={trajectory} />
                            ) : undefined}
                            sceneRef={sceneRef}
                            trajectory={trajectory}
                            trajectoryId={trajectoryId}
                            currentTimestep={currentTimestep}
                            availableTimesteps={availableTimesteps}
                            selectedAnalysisTimesteps={selectedAnalysisTimesteps}
                            analysisId={analysisId}
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
                />
            )}
            <CommandPalette />
            <ExposureSettingsWidget />
            <CanvasAnalysisDiscoveryTour
                enabled={analysisDiscoveryTour.enabled || isGuidedTourRequested}
                storageScopeId={analysisDiscoveryTour.storageScopeId}
                isMobile={isNarrowViewport}
                rightDrawerOpen={rightDrawerOpen}
                onRightDrawerOpenChange={setRightDrawerOpen}
                onActiveChange={setAnalysisDiscoveryTourActive}
                onComplete={() => {
                    setIsGuidedTourRequested(false);
                    closeRightDrawer();
                }}
            />
        </div>
    );
};

export default CanvasPage;
