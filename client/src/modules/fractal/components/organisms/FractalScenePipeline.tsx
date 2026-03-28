import CameraRig from '@/modules/fractal/components/atoms/CameraRig';
import CanvasGrid from '@/modules/fractal/components/atoms/CanvasGrid';
import ScreenshotCapture from '@/modules/fractal/components/atoms/ScreenshotCapture';
import SlicePlaneHelper from '@/modules/fractal/components/atoms/SlicePlaneHelper';
import DynamicEffects from '@/modules/fractal/components/molecules/DynamicEffects';
import DynamicEnvironment from '@/modules/fractal/components/molecules/DynamicEnvironment';
import DynamicLights from '@/modules/fractal/components/molecules/DynamicLights';
import DynamicRenderer from '@/modules/fractal/components/molecules/DynamicRenderer';
import { LightingPreset } from '@/shared/domain/rendering/lights';
import { Theme } from '@/shared/presentation/hooks/use-theme';
import { getActiveAppTheme, subscribeToAppTheme } from '@/shared/presentation/utilities/app-theme';
import { DprMode } from '@/shared/domain/rendering/performance';
import { AdaptiveDpr, Bvh, GizmoHelper, GizmoViewport, OrbitControls, Preload } from '@react-three/drei';
import { useEffect, useMemo, useState } from 'react';

import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';
import type { ScreenshotRequest } from '@/modules/canvas/utilities/screenshot';
import type { FractalSceneConfig } from '@/modules/fractal/types/scene-config';
import type { OrbitControlsHandle } from '@/modules/fractal/types';
import type { ScreenshotComposition } from '@/modules/fractal/types/screenshot-composition';
import type { MutableRefObject, ReactNode } from 'react';

interface GizmoColors {
    axisColors: [string, string, string];
    labelColor: string;
};

interface FractalScenePipelineProps {
    config: FractalSceneConfig;
    orbitRef: MutableRefObject<OrbitControlsHandle | null>;
    orbitProps: Record<string, unknown>;
    showGizmo: boolean;
    showGrid?: boolean;
    modelWorldBounds?: ModelWorldBounds | null;
    screenshotRequest?: ScreenshotRequest | null;
    screenshotComposition?: ScreenshotComposition;
    onScreenshotCaptureHandled?: () => void;
    onScreenshotStatusChange?: (message: string) => void;
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
    screenshotRequest,
    screenshotComposition,
    onScreenshotCaptureHandled,
    onScreenshotStatusChange,
    onControlsRef,
    markInteracting,
    children
}: FractalScenePipelineProps) => {
    const isDefectScene = config.activeScene?.sceneType === 'defect';
    const gridEnabled = showGrid ?? config.grid.enabled;
    const [theme, setTheme] = useState<Theme>(() => getActiveAppTheme());

    useEffect(() => {
        return subscribeToAppTheme(setTheme);
    }, []);

    const darkTheme = theme === Theme.Dark;

    const gizmoColors = useMemo<GizmoColors>(() => {
        if (theme === Theme.Light) {
            return {
                axisColors: ['#f0f0f0', '#f0f0f0', '#f0f0f0'],
                labelColor: '#6F717B'
            };
        }

        return {
            axisColors: ['#4f4f4f', '#4f4f4f', '#4f4f4f'],
            labelColor: '#8e8e93'
        };
    }, [theme]);

    return (
        <>
            <DynamicRenderer settings={config.rendererRuntime} />
            <CameraRig orbitRef={orbitRef} camera={config.camera} />
            <Preload all />
            {config.dpr.mode === DprMode.Adaptive && <AdaptiveDpr pixelated={config.dpr.pixelated} />}
            <OrbitControls
                makeDefault
                ref={(r) => {
                    orbitRef.current = r;
                    onControlsRef?.(r);
                }}
                {...orbitProps}
                onStart={() => markInteracting(true)}
                onEnd={() => markInteracting(false)}
            />
            <DynamicEffects settings={config.effects} isDefectScene={isDefectScene} darkTheme={darkTheme} />
            <DynamicLights
                settings={config.lights}
                preset={isDefectScene ? LightingPreset.Defect : LightingPreset.Trajectory}
                darkTheme={darkTheme}
            />
            <DynamicEnvironment settings={config.environment} darkTheme={darkTheme} />
            {showGizmo && (
                <GizmoHelper alignment='top-left' renderPriority={1} margin={[80, 70]}>
                    <directionalLight position={[5, 5, 5]} intensity={1} />
                    <ambientLight intensity={0.7} />
                    <GizmoViewport
                        scale={30}
                        hideNegativeAxes
                        axisColors={gizmoColors.axisColors}
                        labelColor={gizmoColors.labelColor}
                    />
                </GizmoHelper>
            )}
            {gridEnabled && (
                <CanvasGrid settings={{ ...config.grid, enabled: gridEnabled }} darkTheme={darkTheme} />
            )}
            <SlicePlaneHelper config={config.slicePlaneConfig} modelWorldBounds={modelWorldBounds} />
            <Bvh firstHitOnly>
                {children}
            </Bvh>
            <ScreenshotCapture
                captureRequest={screenshotRequest}
                onCaptureHandled={onScreenshotCaptureHandled ?? (() => undefined)}
                onStatusChange={onScreenshotStatusChange}
                orbitRef={orbitRef}
                modelWorldBounds={modelWorldBounds}
                screenshotComposition={screenshotComposition}
            />
        </>
    );
};

export default FractalScenePipeline;
