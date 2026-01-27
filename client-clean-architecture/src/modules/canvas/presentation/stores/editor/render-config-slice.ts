import type { StateCreator } from 'zustand';
import {
    GL_DEFAULT_CONFIG,
    ORBIT_CONTROLS_DEFAULT_CONFIG,
    SSAO_DEFAULT_CONFIG,
    type RenderConfigStore,
    type RenderConfigState
} from '@/types/stores/editor/render-config';

export interface RenderConfigSlice {
    renderConfig: RenderConfigStore;
}

const initialState: RenderConfigState = {
    gl: GL_DEFAULT_CONFIG,
    orbitControls: ORBIT_CONTROLS_DEFAULT_CONFIG,
    SSAO: SSAO_DEFAULT_CONFIG
};

export const createRenderConfigSlice: StateCreator<any, [], [], RenderConfigSlice> = (set, get) => ({
    renderConfig: {
        ...initialState,
        reset: () => set((s: any) => ({ renderConfig: { ...s.renderConfig, ...initialState } }))
    }
});
