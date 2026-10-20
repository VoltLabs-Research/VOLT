import { resetSectionState, setSectionFieldState } from './store-section';
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
        setPosition: (position: CameraSettingsState['position']) => set((state) => setSectionFieldState(state, 'camera', 'position', position)),
        setUp: (up: CameraSettingsState['up']) => set((state) => setSectionFieldState(state, 'camera', 'up', up)),
        reset: () => set((state) => resetSectionState(state, 'camera', getInitialCameraState()))
    }
});
