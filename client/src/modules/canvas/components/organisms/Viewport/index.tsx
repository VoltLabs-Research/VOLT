import { setSceneInteracting } from '../../../hooks/use-scene-interaction';
import CameraMenuPopover from '../../molecules/CameraMenuPopover';
import RenderMenuPopover from '../../molecules/RenderMenuPopover';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { useScreenshotStore } from '@/modules/canvas/stores/use-screenshot-store';
import FractalScene from '@/modules/fractal/components/organisms/FractalScene';
import TimestepViewer from '@/modules/fractal/components/organisms/TimestepViewer';
import { getFrameBoxBounds, getTrajectoryFrameByTimestep, hasFrameBoxBounds } from '@/modules/fractal/utilities/frame-box-bounds';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
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
import Tooltip from '@/shared/presentation/components/Tooltip';
import useShortcutDiscovery from '@/shared/tips/use-shortcut-discovery';
import { Camera, Gauge } from 'lucide-react';
import { useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { FractalSceneRef } from '@/modules/fractal/components/organisms/FractalScene';
import type { FractalSceneConfig } from '@/modules/fractal/types/scene-config';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import type { ReactNode, RefObject } from 'react';

import './Viewport.css';

interface ViewportProps {
    trajectory: Trajectory | null | undefined;
    currentTimestep: number | undefined;
    sceneConfig: FractalSceneConfig;
    analysisId: string | undefined;
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
    const captureRequested = useScreenshotStore((s) => s.captureRequested);
    const { recordSlowAction: recordScreenshotShortcutTip } = useShortcutDiscovery('canvas-screenshot-shortcut');
    useEnsurePluginCatalogLoaded();
    const { plugins } = usePluginSelectors();
    const {
        activeScenes,
        slicePlaneConfig,
        sceneOpacities,
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
        sceneOpacities: s.sceneOpacities,
        activeModelBounds: s.activeModel?.modelBounds,
        modelWorldBounds: s.modelWorldBounds,
        setModelBounds: s.setModelBounds,
        setModelWorldBounds: s.setModelWorldBounds,
        setModelLoadingState: s.setModelLoadingState,
        setIsPointCloudScene: s.setIsPointCloudScene,
        performancePreset: s.performanceSettings.preset,
        setPerformancePreset: s.performanceSettings.setPreset
    })));

    const pluginScenes = plugins.flatMap((plugin) => {
        return (plugin.exposures ?? []).map((exposure) => ({
            exposureId: exposure._id,
            exportType: exposure.export?.type
        }));
    });

    const currentFrame = useMemo(() => {
        return getTrajectoryFrameByTimestep(trajectory, currentTimestep);
    }, [trajectory, currentTimestep]);
    const currentFrameBoxBounds = useMemo(() => {
        if (!currentFrame || !hasFrameBoxBounds(currentFrame)) {
            return null;
        }

        return getFrameBoxBounds(currentFrame);
    }, [currentFrame]);

    const handleContentTypeDetected = useCallback((info: { hasPointClouds: boolean }) => {
        setIsPointCloudScene(info.hasPointClouds);
    }, [setIsPointCloudScene]);

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

                        <Tooltip content="Screenshot (Ctrl+S)">
                            <Button
                                variant="ghost"
                                intent="canvas"
                                shape="rounded"
                                size="sm"
                                className="font-size-05 canvas-btn-compact"
                                leftIcon={<span className="d-flex items-center content-center f-shrink-0"><Camera size={12} /></span>}
                                onClick={() => {
                                    recordScreenshotShortcutTip();
                                    useScreenshotStore.getState().requestCapture();
                                }}
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
                                    pointCloudSettings={sceneConfig.pointCloudSettings}
                                    slicePlaneConfig={slicePlaneConfig}
                                    boxBounds={currentFrameBoxBounds}
                                    sceneOpacities={sceneOpacities}
                                    setModelWorldBounds={setModelWorldBounds}
                                    activeModelBounds={activeModelBounds}
                                    onModelBoundsChanged={setModelBounds}
                                    onLoadingStateChanged={setModelLoadingState}
                                    scale={TIMESTEP_VIEWER_DEFAULTS.scale}
                                    rotation={TIMESTEP_VIEWER_DEFAULTS.rotation}
                                    position={TIMESTEP_VIEWER_DEFAULTS.position}
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
