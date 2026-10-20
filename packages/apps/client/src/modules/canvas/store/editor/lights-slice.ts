import { resetSectionState } from './store-section';
import { getDefaultLightsState } from '@/shared/rendering/lights';

import type { EditorStore } from './types';
import type { LightsState } from '@/shared/rendering/lights';
import type { StateCreator } from 'zustand';

export interface LightsSlice {
    lights: LightsState & {
        reset: () => void;
    };
}

export const createLightsSlice: StateCreator<EditorStore, [], [], LightsSlice> = (set) => ({
    lights: {
        ...getDefaultLightsState(),
        reset: () => set((state) => resetSectionState(state, 'lights', getDefaultLightsState()))
    }
});
