import { useShallow } from 'zustand/react/shallow';
import { useNavigate } from 'react-router-dom';
import { Box, Camera, Gauge } from 'lucide-react';
import { useScreenshotStore } from '@/modules/canvas/presentation/stores/use-screenshot-store';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import Loader from '@/shared/presentation/components/Loader';
import Tooltip from '@/shared/presentation/components/Tooltip';
import EditableTrajectoryName from '@/modules/trajectory/presentation/components/atoms/EditableTrajectoryName';
import type { PerformancePreset } from '@/modules/fractal/presentation/types/stores/editor/performance-types';
import FractalScene, { type FractalSceneRef } from '@/modules/fractal/presentation/components/organisms/FractalScene';
import TimestepViewer from '@/modules/fractal/presentation/components/organisms/TimestepViewer';
import { getFrameBoxBounds, getTrajectoryFrameByTimestep } from '@/modules/fractal/presentation/utilities/frameBoxBounds';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import type { FractalSceneConfig } from '@/modules/fractal/presentation/types/scene-config';
import type { Trajectory } from '@/modules/trajectory/domain/entities/Trajectory';
import { setSceneInteracting } from '../../../hooks/use-scene-interaction';
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
}

const TIMESTEP_VIEWER_DEFAULTS = {
    scale: 1,
    rotation: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0 }
} as const;

const PERFORMANCE_PRESETS: { label: string; value: PerformancePreset }[] = [
    { label: 'Ultra', value: 'ultra' },
    { label: 'High', value: 'high' },
    { label: 'Balanced', value: 'balanced' },
    { label: 'Performance', value: 'performance' },
    { label: 'Battery', value: 'battery' }
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
    const {
        activeScenes,
        slicePlaneConfig,
        pointSizeMultiplier,
        sceneOpacities,
        activeModelBounds,
        setModelBounds,
        setIsModelLoading,
        performancePreset,
        setPerformancePreset
    } = useEditorStore(useShallow((s) => ({
        activeScenes: s.activeScenes,
        slicePlaneConfig: s.configuration.slicePlaneConfig,
        pointSizeMultiplier: s.pointSizeMultiplier,
        sceneOpacities: s.sceneOpacities,
        activeModelBounds: s.activeModel?.modelBounds,
        setModelBounds: s.setModelBounds,
        setIsModelLoading: s.setIsModelLoading,
        performancePreset: s.performanceSettings.preset,
        setPerformancePreset: s.performanceSettings.setPreset
    })));

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
                        >
                            {trajectory?._id && currentTimestep !== undefined && currentFrame && currentFrameBoxBounds && (
                                <TimestepViewer
                                    trajectoryId={trajectory._id}
                                    currentTimestep={currentTimestep}
                                    analysisId={analysisId}
                                    activeScenes={activeScenes}
                                    slicePlaneConfig={slicePlaneConfig}
                                    boxBounds={currentFrameBoxBounds}
                                    pointSizeMultiplier={pointSizeMultiplier}
                                    sceneOpacities={sceneOpacities}
                                    activeModelBounds={activeModelBounds}
                                    onModelBoundsChanged={setModelBounds}
                                    onLoadingStateChanged={setIsModelLoading}
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
