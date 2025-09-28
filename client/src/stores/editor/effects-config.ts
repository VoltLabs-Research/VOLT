import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EffectsConfigState, EffectsConfigStore } from '@/types/stores/editor/effects-config';
import {
    SSAO_EFFECT_DEFAULT,
    BLOOM_EFFECT_DEFAULT,
    CHROMATIC_ABERRATION_DEFAULT,
    VIGNETTE_DEFAULT,
    DEPTH_OF_FIELD_DEFAULT,
    NOISE_DEFAULT,
    SEPIA_DEFAULT
} from '@/types/stores/editor/effects-config';

const initialState: EffectsConfigState = {
    ssao: SSAO_EFFECT_DEFAULT,
    bloom: BLOOM_EFFECT_DEFAULT,
    chromaticAberration: CHROMATIC_ABERRATION_DEFAULT,
    vignette: VIGNETTE_DEFAULT,
    depthOfField: DEPTH_OF_FIELD_DEFAULT,
    noise: NOISE_DEFAULT,
    sepia: SEPIA_DEFAULT
};

const useEffectsConfigStore = create<EffectsConfigStore>()(persist((set) => ({
    ...initialState,

     setSSAOEffect: (config) => {
        set(state => ({
            ssao: { ...state.ssao, ...config }
        }));
    },

    setBloomEffect: (config) => {
        set(state => ({
            bloom: { ...state.bloom, ...config }
        }));
    },

    setChromaticAberration: (config) => {
        set(state => ({
            chromaticAberration: { ...state.chromaticAberration, ...config }
        }));
    },

    setVignette: (config) => {
        set(state => ({
            vignette: { ...state.vignette, ...config }
        }));
    },

    setDepthOfField: (config) => {
        set(state => ({
            depthOfField: { ...state.depthOfField, ...config }
        }));
    },

    setNoise: (config) => {
        set(state => ({
            noise: { ...state.noise, ...config }
        }));
    },

    setSepia: (config) => {
        set(state => ({
            sepia: { ...state.sepia, ...config }
        }));
    },

    reset: () => {
        set(initialState);
    }
}), {
    name: 'effects-config-storage',
    partialize: (state) => ({
        ssao: state.ssao,
        bloom: state.bloom,
        chromaticAberration: state.chromaticAberration,
        vignette: state.vignette,
        depthOfField: state.depthOfField,
        noise: state.noise,
        sepia: state.sepia
    })
}));

export default useEffectsConfigStore;