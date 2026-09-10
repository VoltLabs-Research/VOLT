import { mergeNestedSectionState, resetSectionState, setSectionFieldState } from './store-section';
import { getDefaultCameraSettings } from '@/shared/rendering/camera';

import type { EditorStore } from './types';
import type { CameraSettingsState, CameraSettingsStore } from '@/modules/fractal/contracts/editor/visual-types';
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
        reset: () => set((state) => resetSectionState(state, 'camera', getInitialCameraState()))
    }
});
