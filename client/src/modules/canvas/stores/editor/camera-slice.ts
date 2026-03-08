import type { StateCreator } from 'zustand';
import { ORTHOGRAPHIC_DEFAULT, PERSPECTIVE_DEFAULT, type CameraSettingsState, type CameraSettingsStore } from '@/modules/fractal/types/stores/editor/visual-types';
import { deepMerge } from '@/shared/utils/deep-merge';
import type { EditorStore } from './types';
import { mergeNestedSectionState, resetSectionState, setSectionFieldState } from './store-section';

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

export const createCameraSlice: StateCreator<EditorStore, [], [], CameraSlice> = (set) => ({
    camera: {
        ...INITIAL_STATE,

        setType: (type: CameraSettingsState['type']) => set((state) => setSectionFieldState(state, 'camera', 'type', type)),

        setPosition: (position: CameraSettingsState['position']) => set((state) => setSectionFieldState(state, 'camera', 'position', position)),

        setUp: (up: CameraSettingsState['up']) => set((state) => setSectionFieldState(state, 'camera', 'up', up)),

        setPerspective: (partial: Partial<CameraSettingsState['perspective']>) => set((state) => mergeNestedSectionState(state, 'camera', 'perspective', partial)),

        setOrthographic: (partial: Partial<CameraSettingsState['orthographic']>) => set((state) => mergeNestedSectionState(state, 'camera', 'orthographic', partial)),

        setCamera: (partial: Partial<CameraSettingsState>) => set((state) => {
            const current = state.camera;
            const next = deepMerge(current, partial as Partial<CameraSettingsStore>);

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

        reset: () => set((state) => resetSectionState(state, 'camera', INITIAL_STATE))
    }
});
