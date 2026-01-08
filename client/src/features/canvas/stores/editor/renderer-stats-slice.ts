import type { StateCreator } from 'zustand';

export interface RendererStats {
    fps: number;
    frameTime: number;
    memory: {
        geometries: number;
        textures: number;
    };
    render: {
        calls: number;
        triangles: number;
        points: number;
        lines: number;
    };
}

export interface RendererStatsSlice {
    rendererStats: RendererStats | null;
    setRendererStats: (stats: RendererStats) => void;
}

const initialRendererStats: RendererStats = {
    fps: 0,
    frameTime: 0,
    memory: { geometries: 0, textures: 0 },
    render: { calls: 0, triangles: 0, points: 0, lines: 0 }
};

export const createRendererStatsSlice: StateCreator<any, [], [], RendererStatsSlice> = (set) => ({
    rendererStats: initialRendererStats,
    setRendererStats: (stats: RendererStats) => set({ rendererStats: stats })
});
