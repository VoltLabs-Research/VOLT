import { setSceneInteracting } from '../../hooks/use-scene-interaction';
import AIViewerActivityBadge from './AIViewerActivityBadge';
import PlaybackTicker from '../PlaybackTicker';
import ViewportFloatingControls from '../ViewportFloatingControls';
import { useEditorStore } from '@/modules/canvas/store/editor';
import { useLocalGlbStore } from '@/modules/canvas/store/use-local-glb-store';
import { useScreenshotStore } from '@/modules/canvas/store/use-screenshot-store';
import FractalScene from '@/modules/fractal/components/organisms/FractalScene';
import LocalGlbViewer from '@/modules/fractal/components/organisms/LocalGlbViewer';
import TimestepViewer from '@/modules/fractal/components/organisms/TimestepViewer';
import { debugFractal } from '@/modules/fractal/utils/debug-log';
import { getFrameBoxBounds, getTrajectoryFrameByTimestep, hasFrameBoxBounds } from '@/modules/fractal/utils/frame-box-bounds';
import { getRenderableScenes } from '@/modules/fractal/utils/scene-utils';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { Box, Stack } from '@voltstack/bravais';
import { useMemo, useCallback, useEffect, memo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { FractalSceneRef } from '@/modules/fractal/components/organisms/FractalScene';
import type { FractalSceneConfig } from '@/modules/fractal/contracts/scene-config';
import type { ScreenshotComposition } from '@/modules/fractal/contracts/screenshot-composition';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
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

const resolveTrajectoryTeamId = (trajectory: Trajectory | null | undefined): string | undefined => {
    if (!trajectory) {
        return undefined;
    }

    // `Ref<Team>` is a deliberate populate union.
    return typeof trajectory.team === 'string' ? trajectory.team : trajectory.team._id;
};

const TIMESTEP_VIEWER_DEFAULTS = {
    scale: 1,
    rotation: {
        x: 0,
        y: 0,
        z: 0
    },
    position: {
        x: 0,
        y: 0,
        z: 0
    }
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
    const teamId = resolveTrajectoryTeamId(trajectory) ?? selectedTeamId;
    const screenshotRequest = useScreenshotStore((s) => s.pendingRequest);
    const {
        activeScenes,
        sceneVisualOverrides,
        activeModelBounds,
        modelWorldBounds,
        setModelBounds,
        setModelWorldBounds,
        setModelLoadingState,
        setIsPointCloudScene
    } = useEditorStore(useShallow((s) => ({
        activeScenes: s.activeScenes,
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
                            {currentFrameBoxBounds && currentFrame && currentTimestep !== undefined && (
                                <TimestepViewer
                                    teamId={teamId}
                                    trajectoryId={trajectory?._id ?? '__local_glb__'}
                                    currentTimestep={resolvedTimestep}
                                    analysisId={analysisId}
                                    activeScenes={activeScenes}
                                    pointCloudSettings={sceneConfig.pointCloudSettings}
                                    boxBounds={currentFrameBoxBounds}
                                    sceneVisualOverrides={sceneVisualOverrides}
                                    setModelWorldBounds={setModelWorldBounds}
                                    activeModelBounds={activeModelBounds}
                                    onModelBoundsChanged={setModelBounds}
                                    onLoadingStateChanged={setModelLoadingState}
                                    scale={TIMESTEP_VIEWER_DEFAULTS.scale}
                                    rotation={TIMESTEP_VIEWER_DEFAULTS.rotation}
                                    position={TIMESTEP_VIEWER_DEFAULTS.position}
                                    autoFit
                                    autoFitKeyOverride={trajectory?._id ?? null}
                                    onContentTypeDetected={handleContentTypeDetected}
                                />
                            )}
                        </FractalScene>
                    </Box>
                )}

                {!hideGradient && <Box position='absolute' inset='0' className="canvas-viewport-gradient" />}

                {analysisOverlay}

                <AIViewerActivityBadge />

                {showSceneActions && <ViewportFloatingControls />}
            </Box>
        </Stack>
    );
};

export default memo(Viewport);
