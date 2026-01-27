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

export interface CanvasGridSettingsStore extends CanvasGridSettingsState {
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
