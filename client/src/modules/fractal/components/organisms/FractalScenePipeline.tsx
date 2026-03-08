import React from 'react';
import { OrbitControls, GizmoHelper, GizmoViewport, AdaptiveDpr, Preload, Bvh } from '@react-three/drei';
import DynamicRenderer from '@/modules/fractal/components/molecules/DynamicRenderer';
import DynamicBackground from '@/modules/fractal/components/molecules/DynamicBackground';
import DynamicEnvironment from '@/modules/fractal/components/molecules/DynamicEnvironment';
import DynamicLights from '@/modules/fractal/components/molecules/DynamicLights';
import DynamicEffects from '@/modules/fractal/components/molecules/DynamicEffects';
import CameraRig from '@/modules/fractal/components/atoms/CameraRig';
import CanvasGrid from '@/modules/fractal/components/atoms/CanvasGrid';
import SlicePlaneHelper from '@/modules/fractal/components/atoms/SlicePlaneHelper';
import ScreenshotCapture from '@/modules/fractal/components/atoms/ScreenshotCapture';
import type { FractalSceneConfig } from '@/modules/fractal/types/scene-config';

interface FractalScenePipelineProps {
    config: FractalSceneConfig;
    orbitRef: React.MutableRefObject<any>;
    orbitProps: Record<string, unknown>;
    showGizmo: boolean;
    showGrid?: boolean;
    onControlsRef?: (ref: any) => void;
    markInteracting: (active: boolean) => void;
    children?: React.ReactNode;
}

const FractalScenePipeline = ({
    config,
    orbitRef,
    orbitProps,
    showGizmo,
    showGrid,
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
            {config.dpr.mode === 'adaptive' && <AdaptiveDpr pixelated={config.dpr.pixelated} />}
            {showGizmo && (
                <GizmoHelper alignment='top-left' renderPriority={2} margin={[450, 70]}>
                    <directionalLight position={[5, 5, 5]} intensity={1} />
                    <ambientLight intensity={0.7} />
                    <GizmoViewport scale={30} hideNegativeAxes axisColors={['#2c2c2e', '#2c2c2e', '#2c2c2e']} labelColor='#8e8e93' />
                </GizmoHelper>
            )}

            <DynamicBackground settings={config.environment} />
            <DynamicEffects
                settings={config.effects}
                isDefectScene={isDefectScene}
                renderConfig={config.renderConfig}
            />
            <DynamicLights settings={config.lights} />
            <DynamicEnvironment settings={config.environment} />

            <DynamicLights preset={isDefectScene ? 'defect' : 'trajectory'} />

            <OrbitControls
                ref={(r) => {
                    orbitRef.current = r;
                    onControlsRef?.(r);
                }}
                {...orbitProps}
                onStart={() => markInteracting(true)}
                onChange={() => markInteracting(true)}
                onEnd={() => markInteracting(false)}
            />

            {gridEnabled && (
                <CanvasGrid settings={{ ...config.grid, enabled: gridEnabled }} />
            )}
            <SlicePlaneHelper config={config.slicePlaneConfig} />

            <color attach="background" args={['#0a0a0a']} />

            <Bvh firstHitOnly>
                {children}
            </Bvh>

            <ScreenshotCapture />
        </>
    );
};

export default FractalScenePipeline;
