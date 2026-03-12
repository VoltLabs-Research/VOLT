import { mergeNestedSectionState, resetSectionState } from './store-section';
import { getDefaultLightsState } from '@/shared/domain/rendering/lights';

import type { EditorStore } from './types';
import type {
    DirLight,
    HemiLight,
    LightsGlobal,
    LightsStore,
    PointLight,
    RectAreaLightCfg,
    SpotLight
} from '@/shared/domain/rendering/lights';
import type { StateCreator } from 'zustand';

export interface LightsSlice {
    lights: LightsStore;
};

export const createLightsSlice: StateCreator<EditorStore, [], [], LightsSlice> = (set) => ({
    lights: {
        ...getDefaultLightsState(),
        setGlobal: (g: Partial<LightsGlobal>) => set((state) => mergeNestedSectionState(state, 'lights', 'global', g)),
        setDirectional: (d: Partial<DirLight>) => set((state) => mergeNestedSectionState(state, 'lights', 'directional', d)),
        setPoint: (p: Partial<PointLight>) => set((state) => mergeNestedSectionState(state, 'lights', 'point', p)),
        setSpot: (sp: Partial<SpotLight>) => set((state) => mergeNestedSectionState(state, 'lights', 'spot', sp)),
        setHemisphere: (h: Partial<HemiLight>) => set((state) => mergeNestedSectionState(state, 'lights', 'hemisphere', h)),
        setRectArea: (r: Partial<RectAreaLightCfg>) => set((state) => mergeNestedSectionState(state, 'lights', 'rectArea', r)),
        reset: () => set((state) => resetSectionState(state, 'lights', getDefaultLightsState()))
    }
});
