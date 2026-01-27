import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createModelSlice } from './model-slice';
import { createPlaybackSlice } from './playback-slice';
import { createTimestepSlice } from './timesteps-slice';
import { createConfigurationSlice } from './configuration-slice';
import type { ModelSlice } from './model-slice';
import type { PlaybackSlice } from './playback-slice';
import type { TimestepSlice } from './timesteps-slice';
import type { ConfigurationSlice } from './configuration-slice';

export type CanvasStore = ModelSlice & PlaybackSlice & TimestepSlice & ConfigurationSlice;

export const useCanvasStore = create<CanvasStore>()(
    persist(
        (set, get, store) => ({
            ...createModelSlice(set, get, store),
            ...createPlaybackSlice(set, get, store),
            ...createTimestepSlice(set, get, store),
            ...createConfigurationSlice(set, get, store)
        }),
        {
            name: 'canvas-storage',
            partialize: (state) => ({
                activeSidebarTab: state.activeSidebarTab,
                playSpeed: state.playSpeed,
                pointSizeMultiplier: state.pointSizeMultiplier
                // Add more as needed to persist
            })
        }
    )
);

export type { ModelSlice, ModelState, ModelActions } from './model-slice';
export type { PlaybackSlice, PlaybackState, PlaybackActions } from './playback-slice';
export type { TimestepSlice, TimestepState, TimestepActions } from './timesteps-slice';
export type { ConfigurationSlice, ConfigurationState, ConfigurationActions } from './configuration-slice';

