import type { StateCreator } from 'zustand';
import type { EffectsConfigStore, EffectsConfigState } from '@/modules/fractal/presentation/types/stores/editor/visual-types';
import {
    SSAO_EFFECT_DEFAULT,
    BLOOM_EFFECT_DEFAULT,
    CHROMATIC_ABERRATION_DEFAULT,
    VIGNETTE_DEFAULT,
    DEPTH_OF_FIELD_DEFAULT,
    NOISE_DEFAULT,
    SEPIA_DEFAULT
} from '@/modules/fractal/presentation/types/stores/editor/visual-types';

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

export const createEffectsSlice: StateCreator<any, [], [], EffectsSlice> = (set) => ({
    effects: {
        ...initialState,
        setSSAOEffect: (config: Partial<typeof SSAO_EFFECT_DEFAULT>) => set((s: EffectsSlice) => ({
            effects: { ...s.effects, ssao: { ...s.effects.ssao, ...config } }
        })),
        setBloomEffect: (config: Partial<typeof BLOOM_EFFECT_DEFAULT>) => set((s: EffectsSlice) => ({
            effects: { ...s.effects, bloom: { ...s.effects.bloom, ...config } }
        })),
        setChromaticAberration: (config: Partial<typeof CHROMATIC_ABERRATION_DEFAULT>) => set((s: EffectsSlice) => ({
            effects: { ...s.effects, chromaticAberration: { ...s.effects.chromaticAberration, ...config } }
        })),
        setVignette: (config: Partial<typeof VIGNETTE_DEFAULT>) => set((s: EffectsSlice) => ({
            effects: { ...s.effects, vignette: { ...s.effects.vignette, ...config } }
        })),
        setDepthOfField: (config: Partial<typeof DEPTH_OF_FIELD_DEFAULT>) => set((s: EffectsSlice) => ({
            effects: { ...s.effects, depthOfField: { ...s.effects.depthOfField, ...config } }
        })),
        setNoise: (config: Partial<typeof NOISE_DEFAULT>) => set((s: EffectsSlice) => ({
            effects: { ...s.effects, noise: { ...s.effects.noise, ...config } }
        })),
        setSepia: (config: Partial<typeof SEPIA_DEFAULT>) => set((s: EffectsSlice) => ({
            effects: { ...s.effects, sepia: { ...s.effects.sepia, ...config } }
        })),
        reset: () => set((s: EffectsSlice) => ({ effects: { ...s.effects, ...initialState } }))
    }
});
