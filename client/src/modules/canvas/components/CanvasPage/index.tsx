import { useKeyboardShortcutsStore } from '../../stores/use-keyboard-shortcuts-store';
import { findCachedAnalysisById } from '@/modules/analysis/services/cache';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import useAnalysisStatus from '../../hooks/use-analysis-status';
import { CanvasAnalysisStatusEnum, normalizeCanvasAnalysisStatus } from '../../utilities/analysis-status';
import useCanvasCleanup from '../../hooks/use-canvas-cleanup';
import useCanvasCoordinator from '../../hooks/use-canvas-coordinator';
import useCanvasUrlState, { CanvasWorkspace } from '../../hooks/use-canvas-url-state';
import useCanvasWorkspace from '@/modules/canvas/collaboration/use-canvas-workspace';
import useLiveModelDrag from '@/modules/canvas/collaboration/use-live-model-drag';
import useWorkspaceCursors from '@/modules/canvas/collaboration/use-workspace-cursors';
import WorkspaceCursorsOverlay from '../WorkspaceCursorsOverlay';
import { useLocalGlbStore } from '@/modules/canvas/stores/use-local-glb-store';
import useDownloadPluginListing from '../../hooks/use-download-plugin-listing';
import useKeyboardShortcuts from '../../hooks/use-keyboard-shortcuts';
import useResizable, { ResizeDirection } from '../../hooks/use-resizable';
import useViewportNarrow from '../../hooks/use-viewport-narrow';
import useDownloadTrajectoryAnalyses from '@/modules/trajectory/hooks/trajectory/use-download-trajectory-analyses';
import CanvasBanners from '../CanvasBanners';
import PreloadingOverlay from '../PreloadingOverlay';
import ResizeHandle from '../ResizeHandle';
import ExposureSettingsWidget from '../ExposureSettingsWidget';
import ShortcutFeedback from '../ShortcutFeedback';
import AnalysisListingDownloadModal, {
    ANALYSIS_LISTING_DOWNLOAD_MODAL_ID
} from '../AnalysisListingDownloadModal';
import CommandPalette from '../CommandPalette';
import PluginResultsViewer from '../PluginResultsViewer';
import RightPanel from '../RightPanel';
import StatusBar from '../StatusBar';
import Timeline from '../Timeline';
import TopToolbar from '../TopToolbar';
import Viewport from '../Viewport';
import AnalysisExecutionOverlay from '../AnalysisExecutionOverlay';
import CanvasAnalysisDiscoveryTour from '../CanvasAnalysisDiscoveryTour';
import useFractalSceneConfig from '@/modules/canvas/hooks/use-fractal-scene-config';
import CanvasRasterViewport from '@/modules/raster/components/CanvasRasterViewport';

import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useCanvasAccessStore, useCanvasCanCollaborate } from '@/modules/canvas/api/access';
import { Download, ExternalLink, PanelRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
import useMedia from '@/shared/presentation/hooks/use-media';
import useTip from '@/shared/tips/use-tip';

import type { FractalSceneRef } from '@/modules/fractal/components/organisms/FractalScene';
import type { DownloadAnalysisListingParams } from '@/modules/canvas/hooks/use-download-plugin-listing';
import type { RasterContainerId, RasterContainerSelection } from '@/modules/raster/types/container-selection';

import './CanvasPage.css';
import { createInitialRasterContainerSelections } from '@/modules/raster/types/container-selection';
import { fetchLocalGlbManifest, resolveLocalGlbUrl } from '@/modules/canvas/utilities/local-glb-manifest';

import type { ResolvedLocalGlbManifest } from '@/modules/canvas/utilities/local-glb-manifest';

interface DownloadExposureListingParams {
    pluginId: string;
    exposureId: string;
    analysisId?: string;
    trajectoryId?: string;
    exposureName?: string;
}

interface CanvasLocationState {
    entry?: string;
    teamId?: string;
}

const CanvasPage = () => {
    usePageTitle('Canvas');
    const { trajectoryId: rawTrajectoryId, ownerId: ownerIdParam } = useParams<{ trajectoryId?: string; ownerId?: string }>();
    const location = useLocation();
    const currentUser = useCurrentUser();
    const isAuthInitialized = useAuthStore((state) => state.isInitialized);
    const hasAuthToken = useAuthStore((state) => state.hasToken);
    const effectiveTrajectoryId = rawTrajectoryId;
    const trajectoryId = effectiveTrajectoryId ?? '';
    const isLocalGlbViewer = !effectiveTrajectoryId;

    useCanvasCleanup();
    const {
        trajectory,
        availableTimesteps,
        currentTimestep,
        isLoading: trajectoryLoading,
        analyses,
        isAnalysesLoading,
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
    const isNarrowViewport = useViewportNarrow();
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
        enabled: Boolean(trajectoryId) && !trajectoryLoading && !isNarrowViewport
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
        updateSearchParams,
        activeWorkspace,
        selectedNotebookId,
        setActiveWorkspace,
        setSelectedNotebookId
    } = useCanvasUrlState();
    const localGlbUrl = useLocalGlbStore((s) => s.localGlbUrl);
    const clearLocalGlb = useLocalGlbStore((s) => s.clearLocalGlb);
    const showStatusBar = searchParams.get('statusBar') !== 'false';
    const hasResolvedCanvasAccess = isLocalGlbViewer || Boolean(canvasAccess);
    const canMutateCanvas = isLocalGlbViewer || Boolean(canvasAccess?.hasTeamMembership);
    const isReadOnlyCanvas = !isLocalGlbViewer && hasResolvedCanvasAccess && !canMutateCanvas;
    const isRasterWorkspace = !isLocalGlbViewer && activeWorkspace === CanvasWorkspace.Raster;
    const isScriptingWorkspace = !isLocalGlbViewer && canMutateCanvas && activeWorkspace === CanvasWorkspace.Scripting;
    const { downloadListing, downloadAnalysisListings, isDownloading } = useDownloadPluginListing();
    const {
        downloadTrajectoryAnalyses,
        isDownloading: isDownloadingTrajectoryAnalyses
    } = useDownloadTrajectoryAnalyses();
    const { statusMap } = useAnalysisStatus({ trajectoryId: trajectory?._id, enabled: !!trajectory?._id });
    const [scriptingJupyterUrl, setScriptingJupyterUrl] = useState<string | null>(null);
    const [rasterContainerSelections, setRasterContainerSelections] = useState<RasterContainerSelection[]>(() => createInitialRasterContainerSelections());
    const [activeRasterContainerId, setActiveRasterContainerId] = useState<RasterContainerId>('container-1');
    const [downloadAnalysisModalTargetId, setDownloadAnalysisModalTargetId] = useState<string | null>(null);
    const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
    const [analysisDiscoveryTourActive, setAnalysisDiscoveryTourActive] = useState(false);
    const [localManifest, setLocalManifest] = useState<ResolvedLocalGlbManifest | null>(null);
    const [localManifestError, setLocalManifestError] = useState<string | null>(null);
    const [isLocalManifestLoading, setIsLocalManifestLoading] = useState(false);

    const localManifestUrl = isLocalGlbViewer ? searchParams.get('manifest')?.trim() || null : null;
    const localGlbQueryUrl = useMemo(() => {
        if (!isLocalGlbViewer) {
            return null;
        }

        const rawUrl = searchParams.get('url')?.trim();
        if (!rawUrl) {
            return null;
        }

        return resolveLocalGlbUrl(rawUrl);
    }, [isLocalGlbViewer, searchParams]);
    const localFrameParam = searchParams.get('frame');

    const handleScriptingNotebookIdChange = useCallback((resolvedNotebookId: string) => {
        if (!resolvedNotebookId || selectedNotebookId === resolvedNotebookId) {
            return;
        }

        setSelectedNotebookId(resolvedNotebookId, { replace: true });
    }, [selectedNotebookId, setSelectedNotebookId]);

    useEffect(() => {
        if (!isNarrowViewport || isScriptingWorkspace) {
            setRightDrawerOpen(false);
        }
    }, [isNarrowViewport, isScriptingWorkspace]);

    useEffect(() => {
        if (!isNarrowViewport || isLocalGlbViewer || !trajectoryId) {
            return;
        }

        const { body, documentElement } = document;
        const scrollY = window.scrollY;
        const previousBodyStyle = {
            position: body.style.position,
            top: body.style.top,
            left: body.style.left,
            right: body.style.right,
            width: body.style.width,
            overflow: body.style.overflow,
            overscrollBehavior: body.style.overscrollBehavior
        };
        const previousDocumentStyle = {
            overflow: documentElement.style.overflow,
            overscrollBehavior: documentElement.style.overscrollBehavior
        };

        body.style.position = 'fixed';
        body.style.top = `-${scrollY}px`;
        body.style.left = '0';
        body.style.right = '0';
        body.style.width = '100%';
        body.style.overflow = 'hidden';
        body.style.overscrollBehavior = 'none';
        documentElement.style.overflow = 'hidden';
        documentElement.style.overscrollBehavior = 'none';

        return () => {
            body.style.position = previousBodyStyle.position;
            body.style.top = previousBodyStyle.top;
            body.style.left = previousBodyStyle.left;
            body.style.right = previousBodyStyle.right;
            body.style.width = previousBodyStyle.width;
            body.style.overflow = previousBodyStyle.overflow;
            body.style.overscrollBehavior = previousBodyStyle.overscrollBehavior;
            documentElement.style.overflow = previousDocumentStyle.overflow;
            documentElement.style.overscrollBehavior = previousDocumentStyle.overscrollBehavior;
            window.scrollTo(0, scrollY);
        };
    }, [isLocalGlbViewer, isNarrowViewport, trajectoryId]);

    useEffect(() => {
        if (!isLocalGlbViewer) {
            return;
        }

        setActiveWorkspace(CanvasWorkspace.Scene, { replace: true });
    }, [isLocalGlbViewer, setActiveWorkspace]);

    useEffect(() => {
        if (!hasResolvedCanvasAccess || canMutateCanvas || activeWorkspace !== CanvasWorkspace.Scripting) {
            return;
        }

        setActiveWorkspace(CanvasWorkspace.Scene, { replace: true });
    }, [activeWorkspace, canMutateCanvas, hasResolvedCanvasAccess, setActiveWorkspace]);

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
        if (!isLocalGlbViewer || !localManifestUrl) {
            setLocalManifest(null);
            setLocalManifestError(null);
            setIsLocalManifestLoading(false);
            return;
        }

        const abortController = new AbortController();
        setIsLocalManifestLoading(true);
        setLocalManifest(null);
        setLocalManifestError(null);

        fetchLocalGlbManifest(resolveLocalGlbUrl(localManifestUrl), abortController.signal)
            .then((nextManifest) => {
                setLocalManifest(nextManifest);
            })
            .catch((error: unknown) => {
                if (abortController.signal.aborted) {
                    return;
                }

                setLocalManifest(null);
                setLocalManifestError(error instanceof Error ? error.message : 'Unexpected manifest error.');
            })
            .finally(() => {
                if (!abortController.signal.aborted) {
                    setIsLocalManifestLoading(false);
                }
            });

        return () => {
            abortController.abort();
        };
    }, [isLocalGlbViewer, localManifestUrl]);

    const localManifestFrameIndex = useMemo(() => {
        if (!localManifest || localManifest.frames.length === 0) {
            return 0;
        }

        const requestedFrame = Number(localFrameParam);
        if (Number.isFinite(requestedFrame)) {
            return Math.max(0, Math.min(localManifest.frames.length - 1, Math.floor(requestedFrame)));
        }

        return localManifest.initialFrame;
    }, [localFrameParam, localManifest]);

    const localManifestFrame = useMemo(() => {
        if (!localManifest || localManifest.frames.length === 0) {
            return null;
        }

        return localManifest.frames[localManifestFrameIndex] ?? localManifest.frames[0] ?? null;
    }, [localManifest, localManifestFrameIndex]);

    const forcedGlbUrl = isLocalGlbViewer
        ? localManifestFrame?.url ?? localGlbQueryUrl ?? localGlbUrl
        : null;

    const setLocalManifestFrameIndex = useCallback((nextIndex: number) => {
        if (!localManifest || localManifest.frames.length === 0) {
            return;
        }

        const clampedIndex = Math.max(0, Math.min(localManifest.frames.length - 1, Math.floor(nextIndex)));
        updateSearchParams({ frame: clampedIndex }, { replace: true });
    }, [localManifest, updateSearchParams]);

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
    const rawOverlayActive = !isLocalGlbViewer && !showNoFramesState && (showLoading || isPreloading);
    const overlayActive = rawOverlayActive && !analysisDiscoveryTourActive;
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

    const handleDownloadExposureListing = useCallback((params: DownloadExposureListingParams) => {
        downloadListing(params);
    }, [downloadListing]);

    const handleAnalysisDiscoveryTourComplete = useCallback(() => {
        setRightDrawerOpen(false);
    }, []);

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

    const cameFromDiscoverTeam = useMemo(() => {
        const state = location.state as CanvasLocationState | null;
        return state?.entry === 'discover-team';
    }, [location.state]);
    const hasDiscoverableAnalyses = !isAnalysesLoading && analyses.length > 0;
    const isAnalysisDiscoveryTourIdentityReady = isAuthInitialized && (!hasAuthToken || Boolean(currentUser?._id));
    const shouldShowAnalysisDiscoveryTour = Boolean(
        cameFromDiscoverTeam
        && hasDiscoverableAnalyses
        && isAnalysisDiscoveryTourIdentityReady
        && !isLocalGlbViewer
        && !isScriptingWorkspace
        && !isRasterWorkspace
        && !showNoFramesState
        && !overlayActive
        && trajectory?._id
    );
    const analysisDiscoveryTourStorageScopeId = currentUser?._id ?? 'anonymous';

    const canDownloadAnalysisListing = Boolean(analysisId && selectedAnalysisStatus === CanvasAnalysisStatusEnum.Completed);
    const canDownloadTrajectoryAnalyses = Boolean(
        trajectory?._id
        && !isDownloadingTrajectoryAnalyses
    );
    const isMobileViewport = useMedia('(max-width: 768px)');

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
                    onNotebookIdChange={handleScriptingNotebookIdChange}
                />
            );
        }

        if (isLocalGlbViewer && isLocalManifestLoading) {
            return (
                <Row justify='center' width='max' height='max'>
                    <EmptyState
                        title='Loading scene manifest'
                        description='Resolving local viewer frames.'
                    />
                </Row>
            );
        }

        if (isLocalGlbViewer && localManifestError) {
            return (
                <Row justify='center' width='max' height='max'>
                    <EmptyState
                        title='Failed to load local scene manifest'
                        description={localManifestError}
                    />
                </Row>
            );
        }

        if (isLocalGlbViewer && !forcedGlbUrl) {
            return (
                <Row justify='center' width='max' height='max'>
                    <EmptyState
                        title='Drop a GLB file to preview'
                        description='Use the dashboard dropzone, or open /canvas/glb?url=... or /canvas/glb?manifest=....'
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

    return (
        <Box
            display='flex'
            height='vh-max'
            width='vw-max'
            overflow='hidden'
            position='relative'
            className={`canvas-editor-root${isNarrowViewport ? ' canvas-editor-root--narrow' : ''}${isReadOnlyCanvas ? ' canvas-editor-root--read-only' : ''}`}
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
                    canDownloadAnalyses={canDownloadTrajectoryAnalyses}
                    onDownloadAnalyses={handleDownloadTrajectoryAnalyses}
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
                                analysisOverlay={!isLocalGlbViewer && !isScriptingWorkspace && !isRasterWorkspace && !showNoFramesState
                                    ? <AnalysisExecutionOverlay trajectory={trajectory} analysisId={analysisId} currentTimestep={currentTimestep} />
                                    : undefined
                                }
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
                        <Stack id="canvas-center-timeline" className="canvas-center-timeline" data-tour-id="canvas-timeline">
                            <Timeline
                                sceneRef={sceneRef}
                                trajectory={trajectory}
                                trajectoryId={trajectoryId}
                                currentTimestep={currentTimestep}
                                availableTimesteps={availableTimesteps}
                                analysisId={analysisId}
                                disableContextualTips={isNarrowViewport}
                                onDownloadExposureListing={handleDownloadExposureListing}
                            />
                        </Stack>
                    )}
                    {isLocalGlbViewer && localManifest && localManifest.frames.length > 1 && (
                        <Stack id="canvas-center-timeline" className="canvas-center-timeline canvas-center-timeline--local">
                            <div className='canvas-local-viewer-controls'>
                                <div className='canvas-local-viewer-controls__meta'>
                                    <div className='canvas-local-viewer-controls__title'>
                                        {localManifest.title || 'Local scene sequence'}
                                    </div>
                                    <div className='canvas-local-viewer-controls__subtitle'>
                                        {localManifestFrame?.label
                                            || (localManifestFrame?.timestep !== undefined
                                                ? `t=${localManifestFrame.timestep}`
                                                : `Frame ${localManifestFrameIndex + 1}`)}
                                    </div>
                                </div>
                                <div className='canvas-local-viewer-controls__transport'>
                                    <Button
                                        variant='outline'
                                        intent='canvas'
                                        size='sm'
                                        shape='rounded'
                                        onClick={() => setLocalManifestFrameIndex(localManifestFrameIndex - 1)}
                                        disabled={localManifestFrameIndex <= 0}
                                    >
                                        Prev
                                    </Button>
                                    <input
                                        className='canvas-local-viewer-controls__slider'
                                        type='range'
                                        min='0'
                                        max={String(localManifest.frames.length - 1)}
                                        step='1'
                                        value={String(localManifestFrameIndex)}
                                        onChange={(event) => setLocalManifestFrameIndex(Number(event.currentTarget.value))}
                                        aria-label='Select local scene frame'
                                    />
                                    <Button
                                        variant='outline'
                                        intent='canvas'
                                        size='sm'
                                        shape='rounded'
                                        onClick={() => setLocalManifestFrameIndex(localManifestFrameIndex + 1)}
                                        disabled={localManifestFrameIndex >= localManifest.frames.length - 1}
                                    >
                                        Next
                                    </Button>
                                </div>
                                <div className='canvas-local-viewer-controls__index'>
                                    {localManifestFrameIndex + 1} / {localManifest.frames.length}
                                </div>
                            </div>
                        </Stack>
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
                <>
                    {isNarrowViewport && (
                        <button
                            type='button'
                            className='canvas-panel-drawer-toggle canvas-panel-drawer-toggle--right'
                            onClick={() => setRightDrawerOpen((open) => !open)}
                            aria-label={rightDrawerOpen ? 'Close canvas panel' : 'Open canvas panel'}
                            title={rightDrawerOpen ? 'Close canvas panel' : 'Open canvas panel'}
                            aria-expanded={rightDrawerOpen}
                            aria-controls='canvas-right-panel'
                            data-tour-id='canvas-analysis-panel-toggle'
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
                        data-analysis-compact={isMobileViewport ? 'true' : undefined}
                    >
                        <RightPanel
                            trajectory={trajectory}
                            trajectoryId={trajectoryId}
                            analysisId={analysisId}
                            currentTimestep={currentTimestep}
                            canMutateCanvas={canMutateCanvas}
                            compactAnalysisOnly={isMobileViewport}
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
            <CommandPalette />
            <ShortcutFeedback />
            <ExposureSettingsWidget />
            <CanvasAnalysisDiscoveryTour
                enabled={shouldShowAnalysisDiscoveryTour}
                storageScopeId={analysisDiscoveryTourStorageScopeId}
                isMobile={isNarrowViewport}
                rightDrawerOpen={rightDrawerOpen}
                onRightDrawerOpenChange={setRightDrawerOpen}
                onActiveChange={setAnalysisDiscoveryTourActive}
                onComplete={handleAnalysisDiscoveryTourComplete}
            />

        </Box>
    );
};

export default CanvasPage;
