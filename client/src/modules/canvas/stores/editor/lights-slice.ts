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
}

const resolveDirectionalUpdate = (partial: Partial<DirLight>): Partial<DirLight> => {
    if (partial.color !== undefined) {
        return {
            ...partial,
            colorFollowsTheme: false
        };
    }

    return partial;
};

const resolvePointUpdate = (partial: Partial<PointLight>): Partial<PointLight> => {
    if (partial.color !== undefined) {
        return {
            ...partial,
            colorFollowsTheme: false
        };
    }

    return partial;
};

const resolveSpotUpdate = (partial: Partial<SpotLight>): Partial<SpotLight> => {
    if (partial.color !== undefined) {
        return {
            ...partial,
            colorFollowsTheme: false
        };
    }

    return partial;
};

const resolveHemisphereUpdate = (partial: Partial<HemiLight>): Partial<HemiLight> => {
    const nextPartial: Partial<HemiLight> = { ...partial };

    if (partial.skyColor !== undefined) {
        nextPartial.skyColorFollowsTheme = false;
    }

    if (partial.groundColor !== undefined) {
        nextPartial.groundColorFollowsTheme = false;
    }

    return nextPartial;
};

const resolveRectAreaUpdate = (partial: Partial<RectAreaLightCfg>): Partial<RectAreaLightCfg> => {
    if (partial.color !== undefined) {
        return {
            ...partial,
            colorFollowsTheme: false
        };
    }

    return partial;
};

export const createLightsSlice: StateCreator<EditorStore, [], [], LightsSlice> = (set) => ({
    lights: {
        ...getDefaultLightsState(),
        setGlobal: (g: Partial<LightsGlobal>) => set((state) => mergeNestedSectionState(state, 'lights', 'global', g)),
        setDirectional: (d: Partial<DirLight>) => set((state) => mergeNestedSectionState(state, 'lights', 'directional', resolveDirectionalUpdate(d))),
        setPoint: (p: Partial<PointLight>) => set((state) => mergeNestedSectionState(state, 'lights', 'point', resolvePointUpdate(p))),
        setSpot: (sp: Partial<SpotLight>) => set((state) => mergeNestedSectionState(state, 'lights', 'spot', resolveSpotUpdate(sp))),
        setHemisphere: (h: Partial<HemiLight>) => set((state) => mergeNestedSectionState(state, 'lights', 'hemisphere', resolveHemisphereUpdate(h))),
        setRectArea: (r: Partial<RectAreaLightCfg>) => set((state) => mergeNestedSectionState(state, 'lights', 'rectArea', resolveRectAreaUpdate(r))),
        reset: () => set((state) => resetSectionState(state, 'lights', getDefaultLightsState()))
    }
});
