import CameraRig from '@/modules/fractal/components/atoms/CameraRig';
import CanvasGrid from '@/modules/fractal/components/atoms/CanvasGrid';
import ScreenshotCapture from '@/modules/fractal/components/atoms/ScreenshotCapture';
import SlicePlaneHelper from '@/modules/fractal/components/atoms/SlicePlaneHelper';
import DynamicEffects from '@/modules/fractal/components/molecules/DynamicEffects';
import DynamicEnvironment from '@/modules/fractal/components/molecules/DynamicEnvironment';
import DynamicLights from '@/modules/fractal/components/molecules/DynamicLights';
import DynamicRenderer from '@/modules/fractal/components/molecules/DynamicRenderer';
import { LightingPreset } from '@/shared/domain/rendering/lights';
import { DprMode } from '@/shared/domain/rendering/performance';
import { AdaptiveDpr, Bvh, GizmoHelper, GizmoViewport, OrbitControls, Preload } from '@react-three/drei';

import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';
import type { FractalSceneConfig } from '@/modules/fractal/types/scene-config';
import type { OrbitControlsHandle } from '@/modules/fractal/types';
import type { MutableRefObject, ReactNode } from 'react';

interface FractalScenePipelineProps {
    config: FractalSceneConfig;
    orbitRef: MutableRefObject<OrbitControlsHandle | null>;
    orbitProps: Record<string, unknown>;
    showGizmo: boolean;
    showGrid?: boolean;
    modelWorldBounds?: ModelWorldBounds | null;
    screenshotCaptureRequested?: boolean;
    onScreenshotCaptureHandled?: () => void;
    onControlsRef?: (ref: OrbitControlsHandle | null) => void;
    markInteracting: (active: boolean) => void;
    children?: ReactNode;
};

const FractalScenePipeline = ({
    config,
    orbitRef,
    orbitProps,
    showGizmo,
    showGrid,
    modelWorldBounds,
    screenshotCaptureRequested = false,
    onScreenshotCaptureHandled,
    onControlsRef,
    markInteracting,
    children
}: FractalScenePipelineProps) => {
    const isDefectScene = config.activeScene?.sceneType === 'defect';
    const gridEnabled = showGrid ?? config.grid.enabled;

    return (
        <>
            <DynamicRenderer settings={config.rendererRuntime} />
            <CameraRig orbitRef={orbitRef} camera={config.camera} />
            <Preload all />
            {config.dpr.mode === DprMode.Adaptive && <AdaptiveDpr pixelated={config.dpr.pixelated} />}
            {showGizmo && (
                <GizmoHelper alignment='top-left' renderPriority={2} margin={[450, 70]}>
                    <directionalLight position={[5, 5, 5]} intensity={1} />
                    <ambientLight intensity={0.7} />
                    <GizmoViewport scale={30} hideNegativeAxes axisColors={['#2c2c2e', '#2c2c2e', '#2c2c2e']} labelColor='#8e8e93' />
                </GizmoHelper>
            )}
            <DynamicEffects settings={config.effects} isDefectScene={isDefectScene} />
            <DynamicLights settings={config.lights} />
            <DynamicEnvironment settings={config.environment} />
            <DynamicLights preset={isDefectScene ? LightingPreset.Defect : LightingPreset.Trajectory} />
            <OrbitControls
                ref={(r) => {
                    orbitRef.current = r;
                    onControlsRef?.(r);
                }}
                {...orbitProps}
                onStart={() => markInteracting(true)}
                onEnd={() => markInteracting(false)}
            />
            {gridEnabled && (
                <CanvasGrid settings={{ ...config.grid, enabled: gridEnabled }} />
            )}
            <SlicePlaneHelper config={config.slicePlaneConfig} modelWorldBounds={modelWorldBounds} />
            <Bvh firstHitOnly>
                {children}
            </Bvh>
            <ScreenshotCapture
                captureRequested={screenshotCaptureRequested}
                onCaptureHandled={onScreenshotCaptureHandled ?? (() => undefined)}
            />
        </>
    );
};

export default FractalScenePipeline;
