import { resetSectionState } from './store-section';
import { getDefaultEffectsSettings } from '@/shared/rendering/effects';

import type { EditorStore } from './types';
import type { EffectsConfigState } from '@/modules/fractal/contracts/editor/visual-types';
import type { StateCreator } from 'zustand';

export interface EffectsSlice {
    effects: EffectsConfigState & {
        reset: () => void;
    };
}

const getInitialEffectsState = (): EffectsConfigState => getDefaultEffectsSettings();

export const createEffectsSlice: StateCreator<EditorStore, [], [], EffectsSlice> = (set) => ({
    effects: {
        ...getInitialEffectsState(),
        reset: () => set((state) => resetSectionState(state, 'effects', getInitialEffectsState()))
    }
});
