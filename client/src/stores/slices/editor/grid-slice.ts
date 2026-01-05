import type { StateCreator } from 'zustand';
import type { CanvasGridSettingsState, CanvasGridSettingsStore } from '@/types/stores/editor/canvas-grid-settings';

export interface GridSlice {
    grid: CanvasGridSettingsStore;
}

const INITIAL: CanvasGridSettingsState = {
    enabled: false,
    infiniteGrid: true,
    cellSize: 0.75,
    sectionSize: 3,
    cellThickness: 0.5,
    sectionThickness: 1,
    fadeDistance: 100,
    fadeStrength: 2,
    sectionColor: '#262626',
    cellColor: '#161616',
    position: [0, 0, 0],
    rotation: [Math.PI / 2, 0, 0]
};

export const createGridSlice: StateCreator<any, [], [], GridSlice> = (set, get) => ({
    grid: {
        ...INITIAL,
        setEnabled: (enabled) => set((s) => ({ grid: { ...s.grid, enabled } })),
        setInfiniteGrid: (infiniteGrid) => set((s) => ({ grid: { ...s.grid, infiniteGrid } })),
        setCellSize: (cellSize) => set((s) => ({ grid: { ...s.grid, cellSize } })),
        setSectionSize: (sectionSize) => set((s) => ({ grid: { ...s.grid, sectionSize } })),
        setCellThickness: (cellThickness) => set((s) => ({ grid: { ...s.grid, cellThickness } })),
        setSectionThickness: (sectionThickness) => set((s) => ({ grid: { ...s.grid, sectionThickness } })),
        setFadeDistance: (fadeDistance) => set((s) => ({ grid: { ...s.grid, fadeDistance } })),
        setFadeStrength: (fadeStrength) => set((s) => ({ grid: { ...s.grid, fadeStrength } })),
        setSectionColor: (sectionColor) => set((s) => ({ grid: { ...s.grid, sectionColor } })),
        setCellColor: (cellColor) => set((s) => ({ grid: { ...s.grid, cellColor } })),
        setPosition: (position) => set((s) => ({ grid: { ...s.grid, position } })),
        setRotation: (rotation) => set((s) => ({ grid: { ...s.grid, rotation } })),
        reset: () => set((s) => ({ grid: { ...s.grid, ...INITIAL } }))
    }
});
