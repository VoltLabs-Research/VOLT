import { setSceneInteracting } from '../../hooks/use-scene-interaction';
import AIViewerActivityBadge from './AIViewerActivityBadge';
import PlaybackTicker from '../PlaybackTicker';
import { useEditorStore } from '@/modules/canvas/store/editor';
import { useLocalGlbStore } from '@/modules/canvas/store/use-local-glb-store';
import { useScreenshotStore } from '@/modules/canvas/store/use-screenshot-store';
import FractalScene from '@/modules/fractal/components/organisms/FractalScene';
import LocalGlbViewer from '@/modules/fractal/components/organisms/LocalGlbViewer';
import TimestepViewer from '@/modules/fractal/components/organisms/TimestepViewer';
import { debugFractal } from '@/modules/fractal/utils/debug-log';
import { getFrameBoxBounds, getTrajectoryFrameByTimestep, hasFrameBoxBounds } from '@/modules/fractal/utils/frame-box-bounds';
import { getRenderableScenes, getSceneKey } from '@/modules/fractal/utils/scene-utils';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { selectHasMergedScenes } from '@/modules/canvas/store/editor/selectors';
import useTip from '@/shared/tips/use-tip';
import { useMemo, useCallback, useEffect, memo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { FractalSceneRef } from '@/modules/fractal/contracts/scene-ref';
import type { FractalSceneConfig } from '@/modules/fractal/contracts/scene-config';
import type { ScreenshotComposition } from '@/modules/fractal/contracts/screenshot-composition';
import type { SceneObjectType } from '@/modules/fractal/contracts/scene';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { ReactNode, RefObject } from 'react';

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
    renderScene: boolean;
    paneScenes?: SceneObjectType[];
    paneMergeGroups?: Record<string, string>;
    paneAnalysisId?: string;
    screenshotEnabled?: boolean;
    playbackEnabled?: boolean;
}

const resolveTrajectoryTeamId = (trajectory: Trajectory | null | undefined): string | undefined => {
    if (!trajectory) {
        return undefined;
    }

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
    renderScene,
    paneScenes,
    paneMergeGroups,
    paneAnalysisId,
    screenshotEnabled = true,
    playbackEnabled = true
}: ViewportProps) => {
    const selectedTeamId = useSelectedTeamId() ?? undefined;
    const teamId = resolveTrajectoryTeamId(trajectory) ?? selectedTeamId;
    const screenshotRequest = useScreenshotStore((s) => screenshotEnabled ? s.pendingRequest : null);
    const isFigureBatchActive = useScreenshotStore((s) => s.isFigureBatchActive);
    const {
        storeActiveScenes,
        sceneVisualOverrides,
        activeModelBounds,
        modelWorldBounds,
        setModelBounds,
        setModelWorldBounds,
        setModelLoadingState,
        setSceneLoadingState,
        setIsPointCloudScene,
        sceneMergeGroups
    } = useEditorStore(useShallow((s) => ({
        storeActiveScenes: s.activeScenes,
        sceneVisualOverrides: s.sceneVisualOverrides,
        activeModelBounds: s.activeModel?.modelBounds,
        modelWorldBounds: s.modelWorldBounds,
        setModelBounds: s.setModelBounds,
        setModelWorldBounds: s.setModelWorldBounds,
        setModelLoadingState: s.setModelLoadingState,
        setSceneLoadingState: s.setSceneLoadingState,
        setIsPointCloudScene: s.setIsPointCloudScene,
        sceneMergeGroups: s.sceneMergeGroups
    })));
    const activeScenes = paneScenes ?? storeActiveScenes;
    const resolvedMergeGroups = paneMergeGroups ?? sceneMergeGroups;
    const resolvedAnalysisId = paneAnalysisId ?? analysisId;

    const currentFrame = useMemo(() => {
        return getTrajectoryFrameByTimestep(trajectory, currentTimestep);
    }, [trajectory, currentTimestep]);
    const currentFrameBoxBounds = useMemo(() => {
        if (!currentFrame || !hasFrameBoxBounds(currentFrame)) {
            return null;
        }

        return getFrameBoxBounds(currentFrame);
    }, [currentFrame]);
    const hasMergedScenes = useEditorStore(selectHasMergedScenes);
    useTip('canvas-models-unified', { enabled: hasMergedScenes });

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

        const isMergedOverlay = renderableScenes.length > 1
            && renderableScenes.every((scene) => Boolean(resolvedMergeGroups[getSceneKey(scene)]));
        if ((renderableScenes.length !== 1 && !isMergedOverlay) || !modelWorldBounds) {
            return undefined;
        }

        return {
            framingBoundsWorld: modelWorldBounds,
            cropBoundsWorld: modelWorldBounds,
            cropSource: 'simulation-cell'
        };
    }, [localAutoSimulationCellWorldBounds, localGlbMode, modelWorldBounds, renderableScenes, resolvedMergeGroups]);

    const handleLoadingStateChanged = useCallback((state: Parameters<typeof setModelLoadingState>[0], sceneKey: string) => {
        setSceneLoadingState(sceneKey, state);
        setModelLoadingState(state);
    }, [setModelLoadingState, setSceneLoadingState]);

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
        <div className='relative flex min-h-0 flex-1 flex-col overflow-hidden'>
            <div className='relative min-h-0 flex-1'>
                {bodyContent && (
                    <div className='relative flex min-h-0 w-full flex-1'>
                        {bodyContent}
                    </div>
                )}

                {renderScene && sceneConfig && (
                    <div className='absolute inset-0' style={bodyContent ? { display: 'none' } : undefined}>
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
                            {playbackEnabled && <PlaybackTicker />}
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
                                    analysisId={resolvedAnalysisId}
                                    activeScenes={activeScenes}
                                    pointCloudSettings={sceneConfig.pointCloudSettings}
                                    boxBounds={currentFrameBoxBounds}
                                    sceneVisualOverrides={sceneVisualOverrides}
                                    setModelWorldBounds={setModelWorldBounds}
                                    activeModelBounds={activeModelBounds}
                                    onModelBoundsChanged={setModelBounds}
                                    onLoadingStateChanged={handleLoadingStateChanged}
                                    scale={TIMESTEP_VIEWER_DEFAULTS.scale}
                                    rotation={TIMESTEP_VIEWER_DEFAULTS.rotation}
                                    position={TIMESTEP_VIEWER_DEFAULTS.position}
                                    autoFit={!isFigureBatchActive}
                                    autoFitKeyOverride={trajectory?._id ?? null}
                                    mergeGroups={resolvedMergeGroups}
                                    onContentTypeDetected={handleContentTypeDetected}
                                />
                            )}
                        </FractalScene>
                    </div>
                )}


                {analysisOverlay}

                <AIViewerActivityBadge />
            </div>
        </div>
    );
};

export default memo(Viewport);
