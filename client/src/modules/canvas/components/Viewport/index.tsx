import { setSceneInteracting } from '../../hooks/use-scene-interaction';
import PlaybackTicker from '../PlaybackTicker';
import ViewportFloatingControls from '../ViewportFloatingControls';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { useLocalGlbStore } from '@/modules/canvas/stores/use-local-glb-store';
import { useScreenshotStore } from '@/modules/canvas/stores/use-screenshot-store';
import FractalScene from '@/modules/fractal/components/organisms/FractalScene';
import LocalGlbViewer from '@/modules/fractal/components/organisms/LocalGlbViewer';
import TimestepViewer from '@/modules/fractal/components/organisms/TimestepViewer';
import { debugFractal } from '@/modules/fractal/utilities/debug-log';
import { getFrameBoxBounds, getTrajectoryFrameByTimestep, hasFrameBoxBounds } from '@/modules/fractal/utilities/frame-box-bounds';
import { getRenderableScenes } from '@/modules/fractal/utilities/scene-utils';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { Box, Stack } from '@voltstack/bravais';
import { useMemo, useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { FractalSceneRef } from '@/modules/fractal/components/organisms/FractalScene';
import type { FractalSceneConfig } from '@/modules/fractal/types/scene-config';
import type { ScreenshotComposition } from '@/modules/fractal/types/screenshot-composition';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';
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
    sceneRef: RefObject<FractalSceneRef | null>;
    bodyContent?: ReactNode;
    analysisOverlay?: ReactNode;
    hideGradient?: boolean;
    renderScene?: boolean;
    showSceneActions?: boolean;
}

type CanvasTrajectory = Trajectory & {
    teamId?: string;
};

const resolveTrajectoryTeamId = (trajectory: CanvasTrajectory | null | undefined): string | undefined => {
    if (!trajectory) {
        return undefined;
    }

    if (typeof trajectory.teamId === 'string' && trajectory.teamId.length > 0) {
        return trajectory.teamId;
    }

    if (!trajectory.team) {
        return undefined;
    }

    if (typeof trajectory.team === 'string') {
        return trajectory.team;
    }

    return trajectory.team._id;
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
    sceneRef,
    bodyContent,
    analysisOverlay,
    hideGradient = false,
    renderScene = true,
    showSceneActions = true
}: ViewportProps) => {
    const selectedTeamId = useSelectedTeamId() ?? undefined;
    const teamId = useMemo(() => {
        return resolveTrajectoryTeamId(trajectory) ?? selectedTeamId;
    }, [selectedTeamId, trajectory]);
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
        setIsPointCloudScene
    } = useEditorStore(useShallow((s) => ({
        activeScenes: s.activeScenes,
        slicePlaneConfig: s.configuration.slicePlaneConfig,
        sceneVisualOverrides: s.sceneVisualOverrides,
        activeModelBounds: s.activeModel?.modelBounds,
        modelWorldBounds: s.modelWorldBounds,
        setModelBounds: s.setModelBounds,
        setModelWorldBounds: s.setModelWorldBounds,
        setModelLoadingState: s.setModelLoadingState,
        setIsPointCloudScene: s.setIsPointCloudScene
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
    const localGlbMode = Boolean(forcedGlbUrl && !trajectory?._id);
    const localModelWorldBounds = useLocalGlbStore((s) => s.localModelWorldBounds);
    const localAutoSimulationCellWorldBounds = useLocalGlbStore((s) => s.localAutoSimulationCellWorldBounds);
    const renderableScenes = useMemo(() => {
        return getRenderableScenes(activeScenes, false);
    }, [activeScenes]);
    const effectiveModelWorldBounds = useMemo(() => {
        if (!localGlbMode) {
            return modelWorldBounds;
        }

        return localModelWorldBounds ?? localAutoSimulationCellWorldBounds ?? null;
    }, [localAutoSimulationCellWorldBounds, localGlbMode, localModelWorldBounds, modelWorldBounds]);
    const screenshotComposition = useMemo<ScreenshotComposition | undefined>(() => {
        if (localGlbMode) {
            if (!localAutoSimulationCellWorldBounds) {
                return undefined;
            }

            return {
                framingBoundsWorld: localAutoSimulationCellWorldBounds,
                cropBoundsWorld: localAutoSimulationCellWorldBounds,
                cropSource: 'auto-simulation-cell'
            };
        }

        if (renderableScenes.length !== 1 || !modelWorldBounds) {
            return undefined;
        }

        return {
            framingBoundsWorld: modelWorldBounds,
            cropBoundsWorld: modelWorldBounds,
            cropSource: 'simulation-cell'
        };
    }, [localAutoSimulationCellWorldBounds, localGlbMode, modelWorldBounds, renderableScenes.length]);

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
        <Stack flex='1' overflow='hidden' position='relative' minH='0' className="canvas-viewport">
            <Box flex='1' position='relative' minH='0' className="canvas-viewport-body">
                {bodyContent && (
                    <Box display='flex' flex='1' minH='0' position='relative' width='max' height='max' className="canvas-viewport-body-content">
                        {bodyContent}
                    </Box>
                )}

                {renderScene && sceneConfig && (
                    <Box position='relative' width='max' height='max' style={bodyContent ? { display: 'none' } : undefined}>
                        <FractalScene
                            ref={sceneRef}
                            config={sceneConfig}
                            showGrid={showGrid}
                            showGizmo={showGizmo}
                            onInteractionChange={setSceneInteracting}
                            modelWorldBounds={effectiveModelWorldBounds}
                            screenshotRequest={screenshotRequest}
                            screenshotComposition={screenshotComposition}
                            onScreenshotCaptureHandled={() => useScreenshotStore.getState().clearPendingRequest()}
                        >
                            <PlaybackTicker />
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
                    </Box>
                )}

                {!hideGradient && <Box position='absolute' inset='0' className="canvas-viewport-gradient" />}

                {analysisOverlay}

                {showSceneActions && <ViewportFloatingControls />}
            </Box>
        </Stack>
    );
};

export default Viewport;
