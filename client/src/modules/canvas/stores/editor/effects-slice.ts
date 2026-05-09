import { mergeNestedSectionState, resetSectionState } from './store-section';
import { getDefaultEffectsSettings } from '@/shared/domain/rendering/effects';

import type { EditorStore } from './types';
import type { EffectsConfigState, EffectsConfigStore, SSAOEffectConfig, BloomEffectConfig, ChromaticAberrationConfig, VignetteEffectConfig, DepthOfFieldConfig, NoiseEffectConfig, SepiaEffectConfig } from '@/modules/fractal/stores/contracts/editor/visual-types';
import type { StateCreator } from 'zustand';

export interface EffectsSlice {
    effects: EffectsConfigStore;
}

const getInitialEffectsState = (): EffectsConfigState => getDefaultEffectsSettings();

export const createEffectsSlice: StateCreator<EditorStore, [], [], EffectsSlice> = (set) => ({
    effects: {
        ...getInitialEffectsState(),
        setSSAOEffect: (config: Partial<SSAOEffectConfig>) => set((state) => mergeNestedSectionState(state, 'effects', 'ssao', config)),
        setBloomEffect: (config: Partial<BloomEffectConfig>) => set((state) => mergeNestedSectionState(state, 'effects', 'bloom', config)),
        setChromaticAberration: (config: Partial<ChromaticAberrationConfig>) => set((state) => mergeNestedSectionState(state, 'effects', 'chromaticAberration', config)),
        setVignette: (config: Partial<VignetteEffectConfig>) => set((state) => mergeNestedSectionState(state, 'effects', 'vignette', config)),
        setDepthOfField: (config: Partial<DepthOfFieldConfig>) => set((state) => mergeNestedSectionState(state, 'effects', 'depthOfField', config)),
        setNoise: (config: Partial<NoiseEffectConfig>) => set((state) => mergeNestedSectionState(state, 'effects', 'noise', config)),
        setSepia: (config: Partial<SepiaEffectConfig>) => set((state) => mergeNestedSectionState(state, 'effects', 'sepia', config)),
        reset: () => set((state) => resetSectionState(state, 'effects', getInitialEffectsState()))
    }
});
