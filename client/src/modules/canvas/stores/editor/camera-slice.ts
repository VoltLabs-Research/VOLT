import { mergeNestedSectionState, resetSectionState, setSectionFieldState } from './store-section';
import {
    CameraType,
    getDefaultCameraSettings
} from '@/shared/domain/rendering/camera';

import type { EditorStore } from './types';
import type {
    CameraSettingsState,
    CameraSettingsStore,
    CameraUpdateState
} from '@/modules/fractal/stores/contracts/editor/visual-types';
import type { StateCreator } from 'zustand';

export interface CameraSlice {
    camera: CameraSettingsStore;
}

const getInitialCameraState = (): CameraSettingsState => getDefaultCameraSettings();

export const createCameraSlice: StateCreator<EditorStore, [], [], CameraSlice> = (set) => ({
    camera: {
        ...getInitialCameraState(),
        setType: (type: CameraSettingsState['type']) => set((state) => setSectionFieldState(state, 'camera', 'type', type)),
        setPosition: (position: CameraSettingsState['position']) => set((state) => setSectionFieldState(state, 'camera', 'position', position)),
        setUp: (up: CameraSettingsState['up']) => set((state) => setSectionFieldState(state, 'camera', 'up', up)),
        setPerspective: (partial: Partial<CameraSettingsState['perspective']>) => set((state) => mergeNestedSectionState(state, 'camera', 'perspective', partial)),
        setOrthographic: (partial: Partial<CameraSettingsState['orthographic']>) => set((state) => mergeNestedSectionState(state, 'camera', 'orthographic', partial)),
        setCamera: (partial: CameraUpdateState) => set((state) => {
            const next: CameraSettingsState = {
                type: partial.type ?? state.camera.type,
                position: partial.position ?? state.camera.position,
                up: partial.up ?? state.camera.up,
                perspective: {
                    ...state.camera.perspective,
                    ...partial.perspective
                },
                orthographic: {
                    ...state.camera.orthographic,
                    ...partial.orthographic
                }
            };

            if (next.type !== CameraType.Perspective && next.type !== CameraType.Orthographic) {
                next.type = CameraType.Perspective;
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
        reset: () => set((state) => resetSectionState(state, 'camera', getInitialCameraState()))
    }
});
