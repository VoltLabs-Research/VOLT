import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deepMerge } from '@/utilities/glb/scene-utils';
import { createCameraSlice, type CameraSlice } from './camera-slice';
import { createGridSlice, type GridSlice } from './grid-slice';
import { createLightsSlice, type LightsSlice } from './lights-slice';
import { createModelSlice } from './model-slice';
import { createOrbitControlsSlice, type OrbitControlsSlice } from './orbit-controls-slice';
import { createPerformanceSlice, type PerformanceSlice } from './performance-slice';
import { createPlaybackSlice } from './playback-slice';
import { createRenderConfigSlice, type RenderConfigSlice } from './render-config-slice';
import { createRendererSlice, type RendererSlice } from './renderer-slice';
import { createTimestepSlice } from './timesteps-slice';
import { createConfigurationSlice, type ConfigurationSlice } from './configuration-slice';
import { createEnvironmentSlice, type EnvironmentSlice } from './environment-slice';
import { createEffectsSlice, type EffectsSlice } from './effects-slice';
import { createRendererStatsSlice, type RendererStatsSlice } from './renderer-stats-slice';

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
            partialize: (state) => ({
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
