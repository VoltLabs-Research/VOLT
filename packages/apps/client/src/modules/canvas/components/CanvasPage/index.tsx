import { cn } from '@heroui/react';
import { useKeyboardShortcutsStore } from '../../store/use-keyboard-shortcuts-store';
import { useEditorStore } from '@/modules/canvas/store/editor';
import { useCanvasPipelineStore } from '@/modules/canvas/store/canvas-pipeline';
import { useCellDisplayStore } from '@/modules/fractal/store/use-cell-display-store';
import useCanvasCleanup from './use-canvas-cleanup';
import useCanvasCoordinator from './use-canvas-coordinator';
import useCanvasUrlState from '../../hooks/use-canvas-url-state';
import useFractalSceneConfig from './use-fractal-scene-config';
import useKeyboardShortcuts from './use-keyboard-shortcuts';
import useResizable, { ResizeDirection } from '../../hooks/use-resizable';
import { useMedia } from '@/shared/ui/hooks/use-media';

import useAnalysisDiscoveryTourGate from './use-analysis-discovery-tour-gate';
import socketService from '@/modules/socket/services/socket-service';
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

import AnalysisExecutionOverlay from '../AnalysisExecutionOverlay';
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
import FileUploaderContainer from '@/shared/ui/components/FileUploaderContainer';
import { useIsWasmCanvas } from '@/modules/canvas-wasm/use-is-wasm-canvas';
import { WASM_TRAJECTORY_ID } from '@/modules/canvas-wasm/constants';
import { useWasmCanvasStore } from '@/modules/canvas-wasm/store';
import { useWasmFrameSync, useWasmTrajectory } from '@/modules/canvas-wasm/use-wasm-canvas';
import useWasmDumpLoader from '@/modules/canvas-wasm/use-wasm-dump-loader';
import WasmDumpEmptyState from '@/modules/canvas-wasm/WasmDumpEmptyState';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import type { RefObject } from 'react';
import type { FileDropUpload } from '@/shared/ui/components/FileUploaderContainer';
import type { FractalSceneRef } from '@/modules/fractal/contracts/scene-ref';



const CanvasPage = () => {
    usePageTitle('Canvas');
    const navigate = useNavigate();
    const { trajectoryId: routeTrajectoryId, ownerId: ownerIdParam } = useParams<{ trajectoryId?: string; ownerId?: string }>();
    const isWasmCanvas = useIsWasmCanvas();
    const trajectoryId = isWasmCanvas ? WASM_TRAJECTORY_ID : (routeTrajectoryId ?? '');
    const isLocalGlbViewer = !isWasmCanvas && !routeTrajectoryId;

    useCanvasCleanup();

    useEffect(() => {
        if (isWasmCanvas) socketService.disconnect();
    }, [isWasmCanvas]);

    const wasmTrajectory = useWasmTrajectory(isWasmCanvas);
    const { wasmHasDump, wasmIsParsing, wasmSessionId } = useWasmCanvasStore(useShallow((state) => ({
        wasmHasDump: state.frames.length > 0,
        wasmIsParsing: state.isParsing,
        wasmSessionId: state.sessionId
    })));
    const { openFiles: openWasmFiles, openSample: openWasmSample } = useWasmDumpLoader();
    const {
        trajectory,
        availableTimesteps,
        selectedAnalysisTimesteps,
        currentTimestep,
        isLoading: remoteTrajectoryLoading,
        analyses,
        isAnalysesLoading,
        error: remoteTrajectoryError,
        access: canvasAccess,
        accessDenied,
        accessDeniedMessage
    } = useCanvasCoordinator({ trajectoryId, localTrajectory: isWasmCanvas ? wasmTrajectory : undefined });
    const trajectoryLoading = remoteTrajectoryLoading;
    const trajectoryError = remoteTrajectoryError;

    const {
        canCollaborate,
        canMutateCanvas,
        isReadOnlyCanvas
    } = useCanvasAccessPublication({
        trajectoryId,
        access: canvasAccess,
        isLocalGlbViewer: isLocalGlbViewer || isWasmCanvas
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
        enabled: canCollaborate && !isWasmCanvas,
        containerRef: viewportContainerRef
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
        searchParams,
        updateSearchParams
    } = useCanvasUrlState();
    const showStatusBar = searchParams.get('statusBar') !== 'false';
    useWasmFrameSync(isWasmCanvas, currentTimestep);

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
    const remotePicker = useTrajectoryFilePicker(navigateToDashboard);
    // One picker for files and folders: a browser dialog offers one or the other, so the input is
    // switched to directory mode just before it opens.
    const wasmFileInputRef = useRef<HTMLInputElement>(null);
    const openWasmPicker = useCallback((directory: boolean) => {
        const input = wasmFileInputRef.current;
        if (!input) return;
        input.webkitdirectory = directory;
        input.click();
    }, []);
    const openWasmFilePicker = useCallback(() => openWasmPicker(false), [openWasmPicker]);
    const openWasmFolderPicker = useCallback(() => openWasmPicker(true), [openWasmPicker]);
    const handleWasmFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? [], (file) => ({ file, path: file.webkitRelativePath || file.name }));
        event.target.value = '';
        await openWasmFiles(files);
    }, [openWasmFiles]);
    const handleWasmDrop = useCallback((uploads: FileDropUpload[]) => {
        void openWasmFiles(uploads.flatMap((upload) => upload.files));
    }, [openWasmFiles]);
    const fileInputRef = isWasmCanvas ? wasmFileInputRef : remotePicker.fileInputRef;
    const handlePickerChange = isWasmCanvas ? handleWasmFileChange : remotePicker.handlePickerChange;
    const openFilePicker = isWasmCanvas ? openWasmFilePicker : remotePicker.openFilePicker;
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


    // /canvas/wasm keeps one trajectory id for every file it opens, so opening another one is
    // signalled by the WASM session instead.
    useEffect(() => {
        const editorState = useEditorStore.getState();
        editorState.resetPlayback();
        editorState.resetModel();
    }, [trajectoryId, wasmSessionId]);

    // What a remote trajectory gets from its own id: no analysis selected, its own cell, and
    // pipeline stages that have not produced anything for it yet. Once per opened trajectory:
    // updateSearchParams changes with every URL change.
    const clearedWasmSessionRef = useRef(0);
    useEffect(() => {
        if (!isWasmCanvas || wasmSessionId === clearedWasmSessionRef.current) return;
        clearedWasmSessionRef.current = wasmSessionId;
        updateSearchParams({ analysisId: null, timelineExposure: null, timestep: null }, { replace: true });
        useCellDisplayStore.getState().clearCellOverride(WASM_TRAJECTORY_ID);
        useCanvasPipelineStore.getState().clearExecutedStages(WASM_TRAJECTORY_ID);
    }, [isWasmCanvas, wasmSessionId, updateSearchParams]);

    const hasFrames = Boolean(trajectory?.frames.length);
    const trajectoryMissing = Boolean(!isWasmCanvas && !trajectoryLoading && trajectoryError && !trajectory && trajectoryId);
    const showNoFramesState = Boolean(
        !isLocalGlbViewer
        && !isWasmCanvas
        && trajectory
        && !hasFrames
    );
    const showsTrajectoryScene = !isLocalGlbViewer && !showNoFramesState;
    // Before the first dump the empty-state card reports parsing; afterwards the overlay covers a replacement.
    const isTrajectoryLoading = isWasmCanvas
        ? wasmIsParsing && wasmHasDump
        : trajectoryLoading
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

    const showWasmEmptyState = isWasmCanvas && !wasmHasDump;

    const toolbarContextualActions = useMemo(() => (
        showWasmEmptyState ? undefined : (
            <CanvasToolbarActions
                analysisId={analysisId}
                canDownloadAnalysis={canDownloadAnalysisListing}
            />
        )
    ), [showWasmEmptyState, analysisId, canDownloadAnalysisListing]);

    const localViewportBodyContent = useViewportBodyContent({
        trajectory,
        isLocalGlbViewer,
        isLocalManifestLoading: localGlbViewer.isManifestLoading,
        localManifestError: localGlbViewer.manifestError,
        forcedGlbUrl: localGlbViewer.forcedGlbUrl,
        showNoFramesState,
    });
    const viewportBodyContent = showWasmEmptyState
        ? (
            <WasmDumpEmptyState
                onChooseFolder={openWasmFolderPicker}
                onTrySample={() => void openWasmSample()}
            />
        )
        : localViewportBodyContent;

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

    const page = (
        <div className={cn('flex relative overflow-hidden w-screen h-dvh bg-background text-foreground', '[--canvas-header-height:55px] max-md:[--canvas-header-height:40px] max-md:[--canvas-mobile-panel-edge:0.75rem] max-md:[--canvas-mobile-panel-top:calc(var(--canvas-header-height,40px)_+_8.75rem)] max-md:[--canvas-mobile-controls-gutter:5rem] max-md:[--canvas-mobile-control-column-size:2.625rem] max-md:[--canvas-mobile-control-column-right:calc(0.5rem_+_env(safe-area-inset-right,0px))] max-md:[--canvas-mobile-drawer-trigger-top:calc(1rem_+_env(safe-area-inset-top,0px))] max-md:[--canvas-mobile-viewport-controls-top:calc(var(--canvas-mobile-drawer-trigger-top)_+_var(--canvas-mobile-control-column-size)_+_0.5rem)]', `canvas-editor-root${isNarrowViewport ? ' canvas-editor-root--narrow' : ''}${isReadOnlyCanvas ? ' canvas-editor-root--read-only' : ''}`)}
        >
            <PreloadingOverlay
                active={overlayActive}
                title={isPreloading ? 'Setting up your scene…' : 'Loading trajectory…'}
                progress={isPreloading ? preloadProgress : undefined}
            />

            {isNarrowViewport && rightDrawerOpen && (
                <button
                    type='button'
                    className='absolute inset-0 z-[4] cursor-pointer border-none p-0 bg-[color-mix(in_srgb,var(--overlay-solid)_55%,transparent)] backdrop-blur-[6px] backdrop-saturate-[1.3] animate-[canvas-drawer-backdrop-in_180ms_ease-out] max-md:z-[130] max-md:bg-transparent max-md:backdrop-filter-none'
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

            <div className='flex flex-col relative overflow-hidden flex-1 min-h-0 canvas-editor-main'>
                <TopToolbar
                    trajectory={trajectory}
                    canMutateCanvas={canMutateCanvas}
                    showBack={!isWasmCanvas}
                    workspacePeers={isWasmCanvas ? [] : peersInLobby}
                    workspaceActiveOwnerId={workspaceOwnerId}
                    onSelectWorkspacePeer={isWasmCanvas ? undefined : navigateToWorkspace}
                    share={isWasmCanvas ? undefined : shareInfo}
                    contextualActions={toolbarContextualActions}
                    isPluginSearchDisabled={showWasmEmptyState}
                    fileMenu={isWasmCanvas
                        ? { onOpen: openFilePicker, onOpenFolder: openWasmFolderPicker, onOpenSample: () => void openWasmSample() }
                        : undefined}
                />

                {!isLocalGlbViewer && !isWasmCanvas && (
                    <CanvasBanners
                        collaborationOwner={collaborationOwner}
                        isWorkspaceOwner={isWorkspaceOwner}
                        onLeaveCollaboration={leaveCollaboration}
                    />
                )}

                <div className='flex min-h-0 flex-1 flex-col overflow-hidden canvas-editor-stage'>
                    <div className='relative flex min-h-0 flex-1 flex-col overflow-hidden canvas-center-viewport' ref={viewportContainerRef as RefObject<HTMLDivElement>}>
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
                                analysisOverlay={analysisOverlay}
                                renderScene={!showNoFramesState}
                            />
                        </ErrorBoundary>
                        <WorkspaceCursorsOverlay
                            cursors={workspaceCursors}
                            containerRef={viewportContainerRef}
                        />
                    </div>

                    {!isLocalGlbViewer && !showWasmEmptyState && (
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

            {!isLocalGlbViewer && !showWasmEmptyState && (
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
                enabled={!isWasmCanvas && (analysisDiscoveryTour.enabled || isGuidedTourRequested)}
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

    // Dropping a dump anywhere on /canvas/wasm opens it, the same overlay the dashboard uses for uploads.
    return isWasmCanvas
        ? <FileUploaderContainer onFilesDropped={handleWasmDrop}>{page}</FileUploaderContainer>
        : page;
};

export default CanvasPage;
