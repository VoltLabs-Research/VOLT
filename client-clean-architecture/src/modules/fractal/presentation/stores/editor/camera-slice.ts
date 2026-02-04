import type { StateCreator } from 'zustand';
import { ORTHOGRAPHIC_DEFAULT, PERSPECTIVE_DEFAULT, type CameraSettingsState, type CameraSettingsStore } from '@/modules/fractal/presentation/types/stores/editor/visual-types';
import { deepMerge } from '@/shared/utils/deep-merge';

export interface CameraSlice {
    camera: CameraSettingsStore;
};

const INITIAL_STATE: CameraSettingsState = {
    type: 'perspective',
    position: [8, 8, 6],
    up: [0, 0, 1],
    perspective: PERSPECTIVE_DEFAULT,
    orthographic: ORTHOGRAPHIC_DEFAULT
};

export const createCameraSlice: StateCreator<any, [], [], CameraSlice> = (set) => ({
    camera: {
        ...INITIAL_STATE,

        setType: (type: CameraSettingsState['type']) => set((state: CameraSlice) => ({
            camera: { ...state.camera, type }
        })),

        setPosition: (position: CameraSettingsState['position']) => set((state: CameraSlice) => ({
            camera: { ...state.camera, position }
        })),

        setUp: (up: CameraSettingsState['up']) => set((state: CameraSlice) => ({
            camera: { ...state.camera, up }
        })),

        setPerspective: (partial: Partial<CameraSettingsState['perspective']>) => set((state: CameraSlice) => ({
            camera: {
                ...state.camera,
                perspective: { ...state.camera.perspective, ...partial }
            }
        })),

        setOrthographic: (partial: Partial<CameraSettingsState['orthographic']>) => set((state: CameraSlice) => ({
            camera: {
                ...state.camera,
                orthographic: { ...state.camera.orthographic, ...partial }
            }
        })),

        setCamera: (partial: Partial<CameraSettingsState>) => set((state: CameraSlice) => {
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

        reset: () => set((state: CameraSlice) => ({
            camera: { ...state.camera, ...INITIAL_STATE }
        }))
    }
});
