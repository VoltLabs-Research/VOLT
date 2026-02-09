import { create } from 'zustand';
import { createCameraSlice, type CameraSlice } from './camera-slice';
import { createLightsSlice, type LightsSlice } from './lights-slice';
import { createModelSlice } from './model-slice';
import { createOrbitControlsSlice, type OrbitControlsSlice } from './orbit-controls-slice';
import { createPerformanceSlice, type PerformanceSlice } from './performance-slice';
import { createPlaybackSlice } from './playback-slice';
import { createRendererSlice, type RendererSlice } from './renderer-slice';
import { createTimestepSlice } from './timesteps-slice';
import { createConfigurationSlice, type ConfigurationSlice } from '../configuration-slice';
import { createEffectsSlice, type EffectsSlice } from './effects-slice';
import {
    createVisualSettingsSlice,
    type VisualSettingsSlice
} from './visual-settings-slice';

import type { ModelStore, PlaybackStore, TimestepStore } from '@/modules/fractal/presentation/types/stores/editor/scene-types';

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
    })
);
