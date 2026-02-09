import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { Box } from 'lucide-react';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import Loader from '@/shared/presentation/components/Loader';
import FractalScene, { type FractalSceneRef } from '@/modules/fractal/presentation/components/organisms/FractalScene';
import TimestepViewer from '@/modules/fractal/presentation/components/organisms/TimestepViewer';
import useTrajectorySelector from '@/modules/trajectory/presentation/hooks/trajectory/use-trajectory-selector';
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
}

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
    showGrid,
    isLoading,
    sceneRef
}: ViewportProps) => {
    const { trajectoryId } = useParams<{ trajectoryId?: string }>();
    const navigate = useNavigate();
    const { options: trajectoryOptions } = useTrajectorySelector();

    const {
        activeScenes,
        slicePlaneConfig,
        pointSizeMultiplier,
        sceneOpacities,
        activeModelBounds,
        setModelBounds,
        setIsModelLoading
    } = useEditorStore(useShallow((s) => ({
        activeScenes: s.activeScenes,
        slicePlaneConfig: s.configuration.slicePlaneConfig,
        pointSizeMultiplier: s.pointSizeMultiplier,
        sceneOpacities: s.sceneOpacities,
        activeModelBounds: s.activeModel?.modelBounds,
        setModelBounds: s.setModelBounds,
        setIsModelLoading: s.setIsModelLoading
    })));

    const handleTabClick = useCallback((id: string) => {
        if (id === trajectoryId) return;
        navigate(`/canvas/${id}`);
    }, [trajectoryId, navigate]);

    return (
        <Container className="canvas-viewport d-flex column flex-1 overflow-hidden p-relative min-h-0">
            <Container className="canvas-viewport-header d-flex items-center f-shrink-0">
                <IconButton variant="ghost" size="sm" aria-label="3D Viewport">
                    <Box size={14} />
                </IconButton>

                {trajectoryOptions.length > 0 && (
                    <>
                        <Container className="canvas-viewport-divider d-block f-shrink-0" />
                        <Container className="px-025 d-flex gap-025" role="tablist" aria-label="Trajectories">
                            {trajectoryOptions.map((opt) => (
                                <Button
                                    key={opt.value}
                                    role="tab"
                                    aria-selected={opt.value === trajectoryId}
                                    variant={opt.value === trajectoryId ? 'solid' : 'ghost'}
                                    intent="canvas"
                                    shape="square"
                                    size="sm"
                                    onClick={() => handleTabClick(opt.value)}
                                    title={opt.title}
                                >
                                    {opt.title}
                                </Button>
                            ))}
                        </Container>
                    </>
                )}

                <Container className="flex-1" />

            </Container>

            <Container className="canvas-viewport-body flex-1 p-relative min-h-0">
                {isLoading && (
                    <Container className="canvas-viewport-loading d-flex items-center content-center p-absolute inset-0">
                        <Loader scale={0.5} />
                    </Container>
                )}

                {sceneConfig && (
                    <Container className="p-relative w-max h-max">
                        <FractalScene
                            ref={sceneRef}
                            config={sceneConfig}
                            showGrid={showGrid}
                            showGizmo={false}
                            onInteractionChange={setSceneInteracting}
                        >
                            {trajectory?._id && currentTimestep !== undefined && (
                                <TimestepViewer
                                    trajectoryId={trajectory._id}
                                    currentTimestep={currentTimestep}
                                    analysisId={analysisId}
                                    activeScenes={activeScenes}
                                    slicePlaneConfig={slicePlaneConfig}
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

                <Container className="canvas-viewport-gradient p-absolute inset-0" />
            </Container>
        </Container>
    );
};

export default Viewport;
