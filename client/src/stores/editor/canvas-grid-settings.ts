import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CanvasGridSettingsState {
    enabled: boolean;
    infiniteGrid: boolean;
    cellSize: number;
    sectionSize: number;
    cellThickness: number;
    sectionThickness: number;
    fadeDistance: number;
    fadeStrength: number;
    sectionColor: string;
    cellColor: string;
    position: [number, number, number];
    rotation: [number, number, number];
}

export interface CanvasGridSettingsActions {
    setEnabled: (enabled: boolean) => void;
    setInfiniteGrid: (infiniteGrid: boolean) => void;
    setCellSize: (cellSize: number) => void;
    setSectionSize: (sectionSize: number) => void;
    setCellThickness: (cellThickness: number) => void;
    setSectionThickness: (sectionThickness: number) => void;
    setFadeDistance: (fadeDistance: number) => void;
    setFadeStrength: (fadeStrength: number) => void;
    setSectionColor: (sectionColor: string) => void;
    setCellColor: (cellColor: string) => void;
    setPosition: (position: [number, number, number]) => void;
    setRotation: (rotation: [number, number, number]) => void;
    reset: () => void;
}

export type CanvasGridSettingsStore = CanvasGridSettingsState & CanvasGridSettingsActions;

const INITIAL: CanvasGridSettingsState = {
    enabled: true,
    infiniteGrid: true,
    cellSize: 0.75,
    sectionSize: 3,
    cellThickness: 0.5,
    sectionThickness: 1,
    fadeDistance: 100,
    fadeStrength: 2,
    sectionColor: '#2b2b2b',
    cellColor: '#3d3d3d',
    position: [0, 0, 0],
    rotation: [Math.PI / 2, 0, 0]
};

const useCanvasGridSettings = create<CanvasGridSettingsStore>()(
    persist(
        (set) => ({
            ...INITIAL,
            setEnabled: (enabled) => set({ enabled }),
            setInfiniteGrid: (infiniteGrid) => set({ infiniteGrid }),
            setCellSize: (cellSize) => set({ cellSize }),
            setSectionSize: (sectionSize) => set({ sectionSize }),
            setCellThickness: (cellThickness) => set({ cellThickness }),
            setSectionThickness: (sectionThickness) => set({ sectionThickness }),
            setFadeDistance: (fadeDistance) => set({ fadeDistance }),
            setFadeStrength: (fadeStrength) => set({ fadeStrength }),
            setSectionColor: (sectionColor) => set({ sectionColor }),
            setCellColor: (cellColor) => set({ cellColor }),
            setPosition: (position) => set({ position }),
            setRotation: (rotation) => set({ rotation }),
            reset: () => set(() => INITIAL)
        }),
        {
            name: 'canvas-grid-settings',
            partialize: (s) => ({
                enabled: s.enabled,
                infiniteGrid: s.infiniteGrid,
                cellSize: s.cellSize,
                sectionSize: s.sectionSize,
                cellThickness: s.cellThickness,
                sectionThickness: s.sectionThickness,
                fadeDistance: s.fadeDistance,
                fadeStrength: s.fadeStrength,
                sectionColor: s.sectionColor,
                cellColor: s.cellColor,
                position: s.position,
                rotation: s.rotation
            })
        }
    )
);

export default useCanvasGridSettings;
