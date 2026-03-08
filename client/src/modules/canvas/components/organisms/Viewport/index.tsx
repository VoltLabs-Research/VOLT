import { setSceneInteracting } from '../../../hooks/use-scene-interaction';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { useScreenshotStore } from '@/modules/canvas/stores/use-screenshot-store';

import { getFrameBoxBounds, getTrajectoryFrameByTimestep } from '@/modules/fractal/utilities/frame-box-bounds';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { Box, Camera, Gauge } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import FractalScene from '@/modules/fractal/components/organisms/FractalScene';
import TimestepViewer from '@/modules/fractal/components/organisms/TimestepViewer';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import EditableTrajectoryName from '@/modules/trajectory/components/atoms/EditableTrajectoryName';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import Loader from '@/shared/presentation/components/Loader';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { PerformancePreset } from '@/modules/fractal/stores/contracts/editor/performance-types';

import type { FractalSceneRef } from '@/modules/fractal/components/organisms/FractalScene';
import type { FractalSceneConfig } from '@/modules/fractal/types/scene-config';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

import './Viewport.css';

interface ViewportProps {
    trajectory: Trajectory | null | undefined;
    currentTimestep: number | undefined;
    sceneConfig: FractalSceneConfig;
    analysisId: string | undefined;
    showGrid: boolean;
    isLoading: boolean;
    sceneRef: React.RefObject<FractalSceneRef | null>;
    bodyContent?: React.ReactNode;
    hideGradient?: boolean;
    headerActionsBeforePerformance?: React.ReactNode;
};

const TIMESTEP_VIEWER_DEFAULTS = {
    scale: 1,
    rotation: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0 }
} as const;

const PERFORMANCE_PRESETS: { label: string; value: PerformancePreset }[] = [
    { label: 'Ultra', value: PerformancePreset.Ultra },
    { label: 'High', value: PerformancePreset.High },
    { label: 'Balanced', value: PerformancePreset.Balanced },
    { label: 'Performance', value: PerformancePreset.Performance },
    { label: 'Battery', value: PerformancePreset.Battery }
];

const Viewport = ({
    trajectory,
    currentTimestep,
    sceneConfig,
    analysisId,
    showGrid,
    isLoading,
    sceneRef,
    bodyContent,
    hideGradient = false,
    headerActionsBeforePerformance
}: ViewportProps) => {
    const navigate = useNavigate();
    const teamId = useSelectedTeamId() ?? undefined;
    const captureRequested = useScreenshotStore((s) => s.captureRequested);
    useEnsurePluginCatalogLoaded();
    const { plugins } = usePluginSelectors();
    const {
        activeScenes,
        slicePlaneConfig,
        pointSizeMultiplier,
        sceneOpacities,
        activeModelBounds,
        modelWorldBounds,
        setModelBounds,
        setModelWorldBounds,
        setModelLoadingState,
        performancePreset,
        setPerformancePreset
    } = useEditorStore(useShallow((s) => ({
        activeScenes: s.activeScenes,
        slicePlaneConfig: s.configuration.slicePlaneConfig,
        pointSizeMultiplier: s.pointSizeMultiplier,
        sceneOpacities: s.sceneOpacities,
        activeModelBounds: s.activeModel?.modelBounds,
        modelWorldBounds: s.modelWorldBounds,
        setModelBounds: s.setModelBounds,
        setModelWorldBounds: s.setModelWorldBounds,
        setModelLoadingState: s.setModelLoadingState,
        performancePreset: s.performanceSettings.preset,
        setPerformancePreset: s.performanceSettings.setPreset
    })));

    const pluginScenes = plugins.flatMap((plugin) => {
        return (plugin.exposures ?? []).map((exposure) => ({
            exposureId: exposure._id,
            exportType: exposure.export?.type
        }));
    });

    const currentFrame = getTrajectoryFrameByTimestep(trajectory, currentTimestep);
    const currentFrameBoxBounds = currentFrame
        ? getFrameBoxBounds(currentFrame)
        : null;

    return (
        <Container className="canvas-viewport d-flex column flex-1 overflow-hidden p-relative min-h-0">
            <Container className="canvas-viewport-header d-flex items-center f-shrink-0">
                <Tooltip content="Back to Dashboard">
                    <IconButton
                        variant="ghost"
                        size="sm"
                        aria-label="Back to Dashboard"
                        onClick={() => navigate('/dashboard')}
                    >
                        <Box size={14} />
                    </IconButton>
                </Tooltip>

                {trajectory && (
                    <>
                        <Container className="canvas-viewport-divider d-block f-shrink-0" />
                        <EditableTrajectoryName
                            trajectoryId={trajectory._id}
                            name={trajectory.name}
                            className="canvas-viewport-trajectory-name"
                        />
                    </>
                )}

                <Container className="flex-1" />

                {headerActionsBeforePerformance}

                <Tooltip content="Screenshot (Ctrl+S)">
                    <Button
                        variant="ghost"
                        intent="canvas"
                        shape="rounded"
                        size="sm"
                        className="font-size-05 canvas-btn-compact"
                        leftIcon={<span className="d-flex items-center content-center f-shrink-0"><Camera size={12} /></span>}
                        onClick={() => useScreenshotStore.getState().requestCapture()}
                    >
                        Screenshot
                    </Button>
                </Tooltip>

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
                            {PERFORMANCE_PRESETS.find((p) => p.value === performancePreset)?.label ?? 'Battery'}
                        </Button>
                    )}
                >
                    {(close) => (
                        <PopoverMenu>
                            {PERFORMANCE_PRESETS.map((preset) => (
                                <Button
                                    key={preset.value}
                                    variant={preset.value === performancePreset ? 'solid' : 'ghost'}
                                    intent="canvas"
                                    shape="rounded"
                                    size="sm"
                                    className="font-size-05"
                                    block
                                    align="start"
                                    onClick={() => { setPerformancePreset(preset.value); close(); }}
                                >
                                    {preset.label}
                                </Button>
                            ))}
                        </PopoverMenu>
                    )}
                </Popover>
            </Container>

            <Container className="canvas-viewport-body flex-1 p-relative min-h-0">
                {!bodyContent && isLoading && (
                    <Container className="canvas-viewport-loading d-flex items-center content-center p-absolute inset-0">
                        <Loader scale={0.5} />
                    </Container>
                )}

                {bodyContent && (
                    <Container className="p-relative w-max h-max">
                        {bodyContent}
                    </Container>
                )}

                {sceneConfig && (
                    <Container
                        className="p-relative w-max h-max"
                        style={bodyContent ? { display: 'none' } : undefined}
                    >
                        <FractalScene
                            ref={sceneRef}
                            config={sceneConfig}
                            showGrid={showGrid}
                            showGizmo={false}
                            onInteractionChange={setSceneInteracting}
                            modelWorldBounds={modelWorldBounds}
                            screenshotCaptureRequested={captureRequested}
                            onScreenshotCaptureHandled={() => useScreenshotStore.getState().clearCaptureRequest()}
                        >
                            {trajectory?._id && currentTimestep !== undefined && currentFrame && currentFrameBoxBounds && (
                                <TimestepViewer
                                    teamId={teamId}
                                    trajectoryId={trajectory._id}
                                    currentTimestep={currentTimestep}
                                    analysisId={analysisId}
                                    activeScenes={activeScenes}
                                    pluginScenes={pluginScenes}
                                    slicePlaneConfig={slicePlaneConfig}
                                    boxBounds={currentFrameBoxBounds}
                                    pointSizeMultiplier={pointSizeMultiplier}
                                    sceneOpacities={sceneOpacities}
                                    setModelWorldBounds={setModelWorldBounds}
                                    activeModelBounds={activeModelBounds}
                                    onModelBoundsChanged={setModelBounds}
                                    onLoadingStateChanged={setModelLoadingState}
                                    scale={TIMESTEP_VIEWER_DEFAULTS.scale}
                                    rotation={TIMESTEP_VIEWER_DEFAULTS.rotation}
                                    position={TIMESTEP_VIEWER_DEFAULTS.position}
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
