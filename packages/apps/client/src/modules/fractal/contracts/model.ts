export interface ModelWorldBounds {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
}

export type Pos3D = {
    x: number;
    y: number;
    z: number;
};

export interface ModelLoadingState {
    isLoading: boolean;
    progress: number;
    error: string | null;
}
