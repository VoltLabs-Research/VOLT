import { create } from 'zustand';
import { 
    GL_DEFAULT_CONFIG,
    ORBIT_CONTROLS_DEFAULT_CONFIG,
    SSAO_DEFAULT_CONFIG,
    type RenderConfigStore, 
    type RenderConfigState } from '@/types/stores/editor/render-config';

const initialState: RenderConfigState = {
    gl: GL_DEFAULT_CONFIG,
    orbitControls: ORBIT_CONTROLS_DEFAULT_CONFIG,
    SSAO: SSAO_DEFAULT_CONFIG
};

const useRenderConfigStore = create<RenderConfigStore>()((set, get) => ({
    ...initialState,

    reset() {
        set(initialState);
    },
}));

export default useRenderConfigStore;