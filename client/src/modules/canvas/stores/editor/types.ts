import type { ConfigurationSlice } from '../configuration-slice';
import type { CameraSlice } from './camera-slice';
import type { EffectsSlice } from './effects-slice';
import type { LightsSlice } from './lights-slice';
import type { OrbitControlsSlice } from './orbit-controls-slice';
import type { PerformanceSlice } from './performance-slice';
import type { RendererSlice } from './renderer-slice';
import type { VisualSettingsSlice } from './visual-settings-slice';
import type { ModelStore, PlaybackStore, TimestepStore } from '@/modules/fractal/stores/contracts/editor/scene-types';

interface EditorStoreActions {
    resetAll: () => void;
};

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
    VisualSettingsSlice &
    EditorStoreActions;
