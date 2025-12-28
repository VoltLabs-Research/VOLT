import type { StateCreator } from 'zustand';
import { ORTHOGRAPHIC_DEFAULT, PERSPECTIVE_DEFAULT, type CameraSettingsState, type CameraSettingsStore } from '@/types/stores/editor/camera-config';
import { deepMerge } from '@/utilities/glb/scene-utils';

export interface CameraSlice {
    camera: CameraSettingsStore;
}

const INITIAL_STATE: CameraSettingsState = {
    type: 'perspective',
    position: [8, 8, 6],
    up: [0, 0, 1],
    perspective: PERSPECTIVE_DEFAULT,
    orthographic: ORTHOGRAPHIC_DEFAULT
};

export const createCameraSlice: StateCreator<any, [], [], CameraSlice> = (set, get) => ({
    camera: {
        ...INITIAL_STATE,

        setType: (type) => set((state) => ({
            camera: { ...state.camera, type }
        })),

        setPosition: (position) => set((state) => ({
            camera: { ...state.camera, position }
        })),

        setUp: (up) => set((state) => ({
            camera: { ...state.camera, up }
        })),

        setPerspective: (partial) => set((state) => ({
            camera: {
                ...state.camera,
                perspective: { ...state.camera.perspective, ...partial }
            }
        })),

        setOrthographic: (partial) => set((state) => ({
            camera: {
                ...state.camera,
                orthographic: { ...state.camera.orthographic, ...partial }
            }
        })),

        setCamera: (partial) => set((state: any) => {
            const current = state.camera;
            const next = deepMerge(current, partial as any);

            if (next.type !== 'perspective' && next.type !== 'orthographic') {
                next.type = 'perspective';
            }

            return {
                camera: {
                    ...state.camera,
                    type: next.type,
                    position: next.position,
                    up: next.up,
                    perspective: next.perspective,
                    orthographic: next.orthographic
                }
            };
        }),

        reset: () => set((state) => ({
            camera: { ...state.camera, ...INITIAL_STATE }
        }))
    }
});
