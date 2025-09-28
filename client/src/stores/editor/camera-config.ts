import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ORTHOGRAPHIC_DEFAULT, PERSPECTIVE_DEFAULT } from '@/types/stores/editor/camera-config';
import { deepMerge } from '@/utilities/scene-utils';
import type { CameraSettingsState, CameraSettingsStore } from '@/types/stores/editor/camera-config';

export const buildR3FCameraProps = (s: CameraSettingsState) => {
    if(s.type === 'orthographic'){
        return {
            orthographic: true,
            position: s.position,
            up: s.up,
            zoom: s.orthographic.zoom,
            near: s.orthographic.near,
            far: s.orthographic.far
        };
    }

    return {
        position: s.position,
        up: s.up,
        fov: s.perspective.fov,
        near: s.perspective.near,
        far: s.perspective.far,
        zoom: s.perspective.zoom,
        focus: s.perspective.focus
    };
};

const INITIAL_STATE: CameraSettingsState = {
    type: 'perspective',
    position: [8, 8, 6],
    up: [0, 0, 1],
    perspective: PERSPECTIVE_DEFAULT,
    orthographic: ORTHOGRAPHIC_DEFAULT
};

const useCameraSettings = create<CameraSettingsStore>()(persist((set) => ({
    ...INITIAL_STATE,
    setType: (type) => set({ type }),
    setPosition: (position) => set({ position }),
    setUp: (up) => set({ up }),

    setPerspective: (partial) =>
        set((state) => ({ perspective: { ...state.perspective, ...partial } })),

    setOrthographic: (partial) =>
        set((state) => ({ orthographic: { ...state.orthographic, ...partial } })),

    setCamera: (partial) =>
        set((state) => {
            const next = deepMerge(state, partial as any);
            if (next.type !== 'perspective' && next.type !== 'orthographic') {
                next.type = 'perspective';
            }
            return {
                type: next.type,
                position: next.position,
                up: next.up,
                perspective: next.perspective,
                orthographic: next.orthographic
            };
        }),

    reset: () => set(() => INITIAL_STATE)
}), {
    name: 'camera-settings-storage',
    partialize: (s) => ({
        type: s.type,
        position: s.position,
        up: s.up,
        perspective: s.perspective,
        orthographic: s.orthographic
    })
}));

export default useCameraSettings;