import { mergeNestedSectionState, resetSectionState } from './store-section';

import { SSAO_EFFECT_DEFAULT, BLOOM_EFFECT_DEFAULT, CHROMATIC_ABERRATION_DEFAULT, VIGNETTE_DEFAULT, DEPTH_OF_FIELD_DEFAULT, NOISE_DEFAULT, SEPIA_DEFAULT } from '@/modules/fractal/stores/contracts/editor/visual-types';

import type { EditorStore } from './types';
import type { EffectsConfigStore, EffectsConfigState } from '@/modules/fractal/stores/contracts/editor/visual-types';
import type { StateCreator } from 'zustand';

export interface EffectsSlice {
    effects: EffectsConfigStore;
};

const initialState: EffectsConfigState = {
    ssao: SSAO_EFFECT_DEFAULT,
    bloom: BLOOM_EFFECT_DEFAULT,
    chromaticAberration: CHROMATIC_ABERRATION_DEFAULT,
    vignette: VIGNETTE_DEFAULT,
    depthOfField: DEPTH_OF_FIELD_DEFAULT,
    noise: NOISE_DEFAULT,
    sepia: SEPIA_DEFAULT
};

export const createEffectsSlice: StateCreator<EditorStore, [], [], EffectsSlice> = (set) => ({
    effects: {
        ...initialState,
        setSSAOEffect: (config: Partial<typeof SSAO_EFFECT_DEFAULT>) => set((state) => mergeNestedSectionState(state, 'effects', 'ssao', config)),
        setBloomEffect: (config: Partial<typeof BLOOM_EFFECT_DEFAULT>) => set((state) => mergeNestedSectionState(state, 'effects', 'bloom', config)),
        setChromaticAberration: (config: Partial<typeof CHROMATIC_ABERRATION_DEFAULT>) => set((state) => mergeNestedSectionState(state, 'effects', 'chromaticAberration', config)),
        setVignette: (config: Partial<typeof VIGNETTE_DEFAULT>) => set((state) => mergeNestedSectionState(state, 'effects', 'vignette', config)),
        setDepthOfField: (config: Partial<typeof DEPTH_OF_FIELD_DEFAULT>) => set((state) => mergeNestedSectionState(state, 'effects', 'depthOfField', config)),
        setNoise: (config: Partial<typeof NOISE_DEFAULT>) => set((state) => mergeNestedSectionState(state, 'effects', 'noise', config)),
        setSepia: (config: Partial<typeof SEPIA_DEFAULT>) => set((state) => mergeNestedSectionState(state, 'effects', 'sepia', config)),
        reset: () => set((state) => resetSectionState(state, 'effects', initialState))
    }
});
