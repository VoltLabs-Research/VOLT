import { resetSectionState, setSectionFieldState, mergeSectionState } from './store-section';
import { getDefaultOrbitControlsSettings } from '@/shared/domain/rendering/camera';

import type { EditorStore } from './types';
import type { OrbitControlsState, OrbitControlsStore } from '@/modules/fractal/stores/contracts/editor/visual-types';
import type { StateCreator } from 'zustand';

export interface OrbitControlsSlice {
    orbitControls: OrbitControlsStore;
}

const getInitialOrbitControlsState = (): OrbitControlsState => getDefaultOrbitControlsSettings();

export const createOrbitControlsSlice: StateCreator<EditorStore, [], [], OrbitControlsSlice> = (set) => ({
    orbitControls: {
        ...getInitialOrbitControlsState(),
        set: (partial: Partial<OrbitControlsState>) => set((state) => mergeSectionState(state, 'orbitControls', partial)),
        setTarget: (t: [number, number, number]) => set((state) => setSectionFieldState(state, 'orbitControls', 'target', t)),
        reset: () => set((state) => resetSectionState(state, 'orbitControls', getInitialOrbitControlsState()))
    }
});
