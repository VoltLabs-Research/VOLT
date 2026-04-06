import { setSceneInteracting } from '../../../hooks/use-scene-interaction';
import CameraMenuPopover from '../../molecules/CameraMenuPopover';
import RenderMenuPopover from '../../molecules/RenderMenuPopover';
import ScreenshotMenuPopover from '../../molecules/ScreenshotMenuPopover';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { useScreenshotStore } from '@/modules/canvas/stores/use-screenshot-store';
import FractalScene from '@/modules/fractal/components/organisms/FractalScene';
import LocalGlbViewer from '@/modules/fractal/components/organisms/LocalGlbViewer';
import TimestepViewer from '@/modules/fractal/components/organisms/TimestepViewer';
import { debugFractal } from '@/modules/fractal/utilities/debug-log';
import { getFrameBoxBounds, getTrajectoryFrameByTimestep, hasFrameBoxBounds } from '@/modules/fractal/utilities/frame-box-bounds';
import { getRenderableScenes } from '@/modules/fractal/utilities/scene-utils';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import EditableTrajectoryName from '@/modules/trajectory/components/atoms/EditableTrajectoryName';
import {
    getPerformancePresetLabel,
    PERFORMANCE_PRESET_OPTIONS
} from '@/shared/domain/rendering/performance';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import { Gauge } from 'lucide-react';
import { useMemo, useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { FractalSceneRef } from '@/modules/fractal/components/organisms/FractalScene';
import type { FractalSceneConfig } from '@/modules/fractal/types/scene-config';
import type { ScreenshotComposition } from '@/modules/fractal/types/screenshot-composition';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import type { ReactNode, RefObject } from 'react';

import './Viewport.css';

interface ViewportProps {
    trajectory: Trajectory | null | undefined;
    currentTimestep: number | undefined;
    sceneConfig: FractalSceneConfig;
    analysisId: string | undefined;
    forcedGlbUrl?: string | null;
    showGrid: boolean;
    showGizmo: boolean;
    isLoading: boolean;
    sceneRef: RefObject<FractalSceneRef | null>;
    bodyContent?: ReactNode;
    hideGradient?: boolean;
    renderScene?: boolean;
    showSceneActions?: boolean;
    headerActionsBeforePerformance?: ReactNode;
};

const TIMESTEP_VIEWER_DEFAULTS = {
    scale: 1,
    rotation: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0 }
} as const;

const Viewport = ({
    trajectory,
    currentTimestep,
    sceneConfig,
    analysisId,
    forcedGlbUrl,
    showGrid,
    showGizmo,
    isLoading,
    sceneRef,
    bodyContent,
    hideGradient = false,
    renderScene = true,
    showSceneActions = true,
    headerActionsBeforePerformance
}: ViewportProps) => {
    const teamId = useSelectedTeamId() ?? undefined;
    const screenshotRequest = useScreenshotStore((s) => s.pendingRequest);
    const {
        activeScenes,
        slicePlaneConfig,
        sceneVisualOverrides,
        activeModelBounds,
        modelWorldBounds,
        setModelBounds,
        setModelWorldBounds,
        setModelLoadingState,
        setIsPointCloudScene,
        performancePreset,
        setPerformancePreset
    } = useEditorStore(useShallow((s) => ({
        activeScenes: s.activeScenes,
        slicePlaneConfig: s.configuration.slicePlaneConfig,
        sceneVisualOverrides: s.sceneVisualOverrides,
        activeModelBounds: s.activeModel?.modelBounds,
        modelWorldBounds: s.modelWorldBounds,
        setModelBounds: s.setModelBounds,
        setModelWorldBounds: s.setModelWorldBounds,
        setModelLoadingState: s.setModelLoadingState,
        setIsPointCloudScene: s.setIsPointCloudScene,
        performancePreset: s.performanceSettings.preset,
        setPerformancePreset: s.performanceSettings.setPreset
    })));

    const currentFrame = useMemo(() => {
        return getTrajectoryFrameByTimestep(trajectory, currentTimestep);
    }, [trajectory, currentTimestep]);
    const currentFrameBoxBounds = useMemo(() => {
        if (!currentFrame || !hasFrameBoxBounds(currentFrame)) {
            return null;
        }

        return getFrameBoxBounds(currentFrame);
    }, [currentFrame]);
    const renderableScenes = useMemo(() => {
        return getRenderableScenes(activeScenes, false);
    }, [activeScenes]);
    const screenshotComposition = useMemo<ScreenshotComposition | undefined>(() => {
        if (renderableScenes.length !== 1 || !modelWorldBounds) {
            return undefined;
        }

        return {
            framingBoundsWorld: modelWorldBounds,
            cropBoundsWorld: modelWorldBounds,
            cropSource: 'simulation-cell'
        };
    }, [modelWorldBounds, renderableScenes.length]);

    const handleContentTypeDetected = useCallback((info: { hasPointClouds: boolean }) => {
        debugFractal('viewport.content-type-detected', {
            trajectoryId: trajectory?._id,
            timestep: currentTimestep,
            hasPointClouds: info.hasPointClouds
        });
        setIsPointCloudScene(info.hasPointClouds);
    }, [currentTimestep, setIsPointCloudScene, trajectory?._id]);

    useEffect(() => {
        if (!trajectory?._id || currentTimestep === undefined || !currentFrameBoxBounds) {
            return;
        }

        debugFractal('viewport.frame-ready', {
            trajectoryId: trajectory._id,
            timestep: currentTimestep,
            boxBounds: currentFrameBoxBounds,
            sceneCount: activeScenes.length
        });
    }, [activeScenes.length, currentFrameBoxBounds, currentTimestep, trajectory?._id]);

    const localGlbMode = Boolean(forcedGlbUrl && !trajectory?._id);
    const resolvedTimestep = currentTimestep ?? 0;
    const resolvedBoxBounds = currentFrameBoxBounds;
    const canRenderTimestepViewer = Boolean(
        resolvedBoxBounds
        && trajectory?._id
        && currentTimestep !== undefined
        && currentFrame
    );
    const viewerTrajectoryId = trajectory?._id ?? '__local_glb__';
    const autoFitKeyOverride = trajectory?._id ?? null;

    return (
        <Container className="canvas-viewport d-flex column flex-1 overflow-hidden p-relative min-h-0">
            <Container className="canvas-viewport-header d-flex items-center f-shrink-0">
                {trajectory && (
                    <EditableTrajectoryName
                        trajectoryId={trajectory._id}
                        name={trajectory.name}
                        className="canvas-viewport-trajectory-name"
                    />
                )}

                <Container className="flex-1" />

                {headerActionsBeforePerformance}

                {showSceneActions && (
                    <>
                        <RenderMenuPopover />

                        <CameraMenuPopover />

                        <ScreenshotMenuPopover />

                        <Popover
                            id="viewport-performance"
                            noPadding
                            trigger={(
                                <Button
                                    variant="ghost"
                                    intent="canvas"
                                    shape="rounded"
                                    size="sm"
                                    className="font-size-05 canvas-btn-compact"
                                    leftIcon={<span className="d-flex items-center content-center f-shrink-0"><Gauge size={12} /></span>}
                                >
                                    {getPerformancePresetLabel(performancePreset)}
                                </Button>
                            )}
                        >
                            {(close) => (
                                <PopoverMenu>
                                    {PERFORMANCE_PRESET_OPTIONS.map((preset) => (
                                        <Button
                                            key={preset.value}
                                            variant={preset.value === performancePreset ? 'solid' : 'ghost'}
                                            intent="canvas"
                                            shape="rounded"
                                            size="sm"
                                            className="font-size-05"
                                            block
                                            align="start"
                                            onClick={() => {
                                                setPerformancePreset(preset.value);
                                                close();
                                            }}
                                        >
                                            {preset.title}
                                        </Button>
                                    ))}
                                </PopoverMenu>
                            )}
                        </Popover>
                    </>
                )}
            </Container>

            <Container className="canvas-viewport-body flex-1 p-relative min-h-0">
                {!bodyContent && isLoading && (
                    <Container className="canvas-viewport-loading d-flex items-center content-center p-absolute inset-0">
                        <Loader scale={0.5} />
                    </Container>
                )}

                {bodyContent && (
                    <Container className="canvas-viewport-body-content d-flex flex-1 min-h-0 p-relative w-max h-max">
                        {bodyContent}
                    </Container>
                )}

                {renderScene && sceneConfig && (
                    <Container
                        className="p-relative w-max h-max"
                        style={bodyContent ? { display: 'none' } : undefined}
                    >
                        <FractalScene
                            ref={sceneRef}
                            config={sceneConfig}
                            showGrid={showGrid}
                            showGizmo={showGizmo}
                            onInteractionChange={setSceneInteracting}
                            modelWorldBounds={modelWorldBounds}
                            screenshotRequest={screenshotRequest}
                            screenshotComposition={screenshotComposition}
                            onScreenshotCaptureHandled={() => useScreenshotStore.getState().clearPendingRequest()}
                        >
                            {localGlbMode && forcedGlbUrl && (
                                <LocalGlbViewer
                                    url={forcedGlbUrl}
                                    onContentTypeDetected={handleContentTypeDetected}
                                />
                            )}
                            {canRenderTimestepViewer && resolvedBoxBounds && (
                                <TimestepViewer
                                    teamId={teamId}
                                    trajectoryId={viewerTrajectoryId}
                                    currentTimestep={resolvedTimestep}
                                    analysisId={analysisId}
                                    activeScenes={activeScenes}
                                    pointCloudSettings={sceneConfig.pointCloudSettings}
                                    slicePlaneConfig={slicePlaneConfig}
                                    boxBounds={resolvedBoxBounds}
                                    sceneVisualOverrides={sceneVisualOverrides}
                                    setModelWorldBounds={setModelWorldBounds}
                                    activeModelBounds={activeModelBounds}
                                    onModelBoundsChanged={setModelBounds}
                                    onLoadingStateChanged={setModelLoadingState}
                                    scale={TIMESTEP_VIEWER_DEFAULTS.scale}
                                    rotation={TIMESTEP_VIEWER_DEFAULTS.rotation}
                                    position={TIMESTEP_VIEWER_DEFAULTS.position}
                                    autoFit
                                    autoFitKeyOverride={autoFitKeyOverride}
                                    onContentTypeDetected={handleContentTypeDetected}
                                />
                            )}
                        </FractalScene>
                    </Container>
                )}

                {!hideGradient && <Container className="canvas-viewport-gradient p-absolute inset-0" />}
            </Container>
        </Container>
    );
};

export default Viewport;
