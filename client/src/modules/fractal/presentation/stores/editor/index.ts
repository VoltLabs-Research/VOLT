import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deepMerge } from '@/shared/utils/deep-merge';
import { createCameraSlice, type CameraSlice } from '@/modules/fractal/presentation/stores/editor/camera-slice';
import { createLightsSlice, type LightsSlice } from '@/modules/fractal/presentation/stores/editor/lights-slice';
import { createModelSlice } from '@/modules/fractal/presentation/stores/editor/model-slice';
import { createOrbitControlsSlice, type OrbitControlsSlice } from '@/modules/fractal/presentation/stores/editor/orbit-controls-slice';
import { createPerformanceSlice, type PerformanceSlice } from '@/modules/fractal/presentation/stores/editor/performance-slice';
import { createPlaybackSlice } from '@/modules/fractal/presentation/stores/editor/playback-slice';
import { createRendererSlice, type RendererSlice } from '@/modules/fractal/presentation/stores/editor/renderer-slice';
import { createTimestepSlice } from '@/modules/fractal/presentation/stores/editor/timesteps-slice';
import { createConfigurationSlice, type ConfigurationSlice } from '@/modules/fractal/presentation/stores/configuration-slice';
import { createEffectsSlice, type EffectsSlice } from '@/modules/fractal/presentation/stores/editor/effects-slice';
import {
    createVisualSettingsSlice,
    type VisualSettingsSlice,
    type GridSlice,
    type EnvironmentSlice,
    type RenderConfigSlice,
    type RendererStatsSlice
} from '@/modules/fractal/presentation/stores/editor/visual-settings-slice';

import type { ModelStore, PlaybackStore, TimestepStore } from '@/modules/fractal/presentation/types/stores/editor/scene-types';

// Re-export slice types for backward compatibility
export type { GridSlice, EnvironmentSlice, RenderConfigSlice, RendererStatsSlice };

export type EditorStore =
    ModelStore &
    PlaybackStore &
    TimestepStore &
    CameraSlice &
    LightsSlice &
    OrbitControlsSlice &
    PerformanceSlice &
    RendererSlice &
    ConfigurationSlice &
    EffectsSlice &
    VisualSettingsSlice;

export const useEditorStore = create<EditorStore>()(
    persist(
        (...args) => ({
            ...createModelSlice(...args),
            ...createPlaybackSlice(...args),
            ...createTimestepSlice(...args),
            ...createCameraSlice(...args),
            ...createLightsSlice(...args),
            ...createOrbitControlsSlice(...args),
            ...createPerformanceSlice(...args),
            ...createRendererSlice(...args),
            ...createConfigurationSlice(...args),
            ...createEffectsSlice(...args),
            ...createVisualSettingsSlice(...args),
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
                configuration: {
                    slicePlaneConfig: undefined
                },
                activeScene: state.activeScene,
                activeScenes: state.activeScenes,
                environment: state.environment,
                effects: state.effects,
            }),
            merge: (persistedState, currentState) => {
                return deepMerge(currentState, persistedState as any);
            }
        }
    )
);
