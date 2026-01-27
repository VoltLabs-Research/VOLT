import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deepMerge } from '@/modules/canvas/presentation/utilities/scene-utils';
import { createCameraSlice, type CameraSlice } from '@/modules/canvas/presentation/stores/editor/camera-slice';
import { createGridSlice, type GridSlice } from '@/modules/canvas/presentation/stores/editor/grid-slice';
import { createLightsSlice, type LightsSlice } from '@/modules/canvas/presentation/stores/editor/lights-slice';
import { createModelSlice } from '@/modules/canvas/presentation/stores/editor/model-slice';
import { createOrbitControlsSlice, type OrbitControlsSlice } from '@/modules/canvas/presentation/stores/editor/orbit-controls-slice';
import { createPerformanceSlice, type PerformanceSlice } from '@/modules/canvas/presentation/stores/editor/performance-slice';
import { createPlaybackSlice } from '@/modules/canvas/presentation/stores/editor/playback-slice';
import { createRenderConfigSlice, type RenderConfigSlice } from '@/modules/canvas/presentation/stores/editor/render-config-slice';
import { createRendererSlice, type RendererSlice } from '@/modules/canvas/presentation/stores/editor/renderer-slice';
import { createTimestepSlice } from '@/modules/canvas/presentation/stores/editor/timesteps-slice';
import { createConfigurationSlice, type ConfigurationSlice } from '@/modules/canvas/presentation/stores/editor/configuration-slice';
import { createEnvironmentSlice, type EnvironmentSlice } from '@/modules/canvas/presentation/stores/editor/environment-slice';
import { createEffectsSlice, type EffectsSlice } from '@/modules/canvas/presentation/stores/editor/effects-slice';
import { createRendererStatsSlice, type RendererStatsSlice } from '@/modules/canvas/presentation/stores/editor/renderer-stats-slice';

import type { ModelStore } from '@/types/stores/editor/model';
import type { PlaybackStore } from '@/types/stores/editor/playback';
import type { TimestepStore } from '@/types/stores/editor/timesteps';

// Define the combined store type
export type EditorStore =
    ModelStore &
    PlaybackStore &
    TimestepStore &
    CameraSlice &
    GridSlice &
    LightsSlice &
    OrbitControlsSlice &
    PerformanceSlice &
    RenderConfigSlice &
    RendererSlice &
    ConfigurationSlice &
    EnvironmentSlice &
    EffectsSlice &
    RendererStatsSlice;

export const useEditorStore = create<EditorStore>()(
    persist(
        (...args) => ({
            ...createModelSlice(...args),
            ...createPlaybackSlice(...args),
            ...createTimestepSlice(...args),
            ...createCameraSlice(...args),
            ...createGridSlice(...args),
            ...createLightsSlice(...args),
            ...createOrbitControlsSlice(...args),
            ...createPerformanceSlice(...args),
            ...createRenderConfigSlice(...args),
            ...createRendererSlice(...args),
            ...createConfigurationSlice(...args),
            ...createEnvironmentSlice(...args),
            ...createEffectsSlice(...args),
            ...createRendererStatsSlice(...args),
        }),
        {
            name: 'editor-storage-v2',
            partialize: (state: any) => ({
                camera: state.camera,
                grid: state.grid,
                lights: state.lights,
                orbitControls: state.orbitControls,
                performanceSettings: state.performanceSettings,
                renderConfig: state.renderConfig,
                rendererSettings: state.rendererSettings,
                configuration: state.configuration,
                environment: state.environment,
                effects: state.effects,
            }),
            merge: (persistedState, currentState) => {
                return deepMerge(currentState, persistedState as any);
            }
        }
    )
);
