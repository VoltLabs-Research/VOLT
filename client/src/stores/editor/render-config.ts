import { create } from 'zustand';
import { 
    GL_DEFAULT_CONFIG,
    ORBIT_CONTROLS_DEFAULT_CONFIG,
    SSAO_DEFAULT_CONFIG,
    CAMERA_DEFAULT_CONFIG,
    type RenderConfigStore, 
    type RenderConfigState } from '@/types/stores/editor/render-config';

const initialState: RenderConfigState = {
    camera: CAMERA_DEFAULT_CONFIG,
    gl: GL_DEFAULT_CONFIG,
    orbitControls: ORBIT_CONTROLS_DEFAULT_CONFIG,
    SSAO: SSAO_DEFAULT_CONFIG
};

const useRenderConfigStore = create<RenderConfigStore>()((set, get) => ({
    ...initialState
}));

export default useRenderConfigStore;