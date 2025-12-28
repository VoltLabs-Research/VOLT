import type { StateCreator } from 'zustand';
import type { EffectsConfigStore, EffectsConfigState } from '@/types/stores/editor/effects-config';
import {
    SSAO_EFFECT_DEFAULT,
    BLOOM_EFFECT_DEFAULT,
    CHROMATIC_ABERRATION_DEFAULT,
    VIGNETTE_DEFAULT,
    DEPTH_OF_FIELD_DEFAULT,
    NOISE_DEFAULT,
    SEPIA_DEFAULT
} from '@/types/stores/editor/effects-config';

export interface EffectsSlice {
    effects: EffectsConfigStore;
}

const initialState: EffectsConfigState = {
    ssao: SSAO_EFFECT_DEFAULT,
    bloom: BLOOM_EFFECT_DEFAULT,
    chromaticAberration: CHROMATIC_ABERRATION_DEFAULT,
    vignette: VIGNETTE_DEFAULT,
    depthOfField: DEPTH_OF_FIELD_DEFAULT,
    noise: NOISE_DEFAULT,
    sepia: SEPIA_DEFAULT
};

export const createEffectsSlice: StateCreator<any, [], [], EffectsSlice> = (set, get) => ({
    effects: {
        ...initialState,
        setSSAOEffect: (config) => set((s) => ({
            effects: { ...s.effects, ssao: { ...s.effects.ssao, ...config } }
        })),
        setBloomEffect: (config) => set((s) => ({
            effects: { ...s.effects, bloom: { ...s.effects.bloom, ...config } }
        })),
        setChromaticAberration: (config) => set((s) => ({
            effects: { ...s.effects, chromaticAberration: { ...s.effects.chromaticAberration, ...config } }
        })),
        setVignette: (config) => set((s) => ({
            effects: { ...s.effects, vignette: { ...s.effects.vignette, ...config } }
        })),
        setDepthOfField: (config) => set((s) => ({
            effects: { ...s.effects, depthOfField: { ...s.effects.depthOfField, ...config } }
        })),
        setNoise: (config) => set((s) => ({
            effects: { ...s.effects, noise: { ...s.effects.noise, ...config } }
        })),
        setSepia: (config) => set((s) => ({
            effects: { ...s.effects, sepia: { ...s.effects.sepia, ...config } }
        })),
        reset: () => set((s) => ({ effects: { ...s.effects, ...initialState } }))
    }
});
