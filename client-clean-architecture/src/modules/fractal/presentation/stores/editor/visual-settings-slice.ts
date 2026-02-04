import type { StateCreator } from 'zustand';
import type { CanvasGridSettingsState, CanvasGridSettingsStore, EnvironmentConfigStore } from '@/modules/fractal/presentation/types/stores/editor/visual-types';
import { ENVIRONMENT_DEFAULT_CONFIG } from '@/modules/fractal/presentation/types/stores/editor/visual-types';
import {
    GL_DEFAULT_CONFIG,
    ORBIT_CONTROLS_DEFAULT_CONFIG,
    SSAO_DEFAULT_CONFIG,
    type RenderConfigStore,
    type RenderConfigState
} from '@/modules/fractal/presentation/types/stores/editor/performance-types';

// ============================================================================
// Renderer Stats Types (kept here to avoid breaking imports)
// ============================================================================
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

// ============================================================================
// Slice Interface
// ============================================================================
export interface VisualSettingsSlice {
    grid: CanvasGridSettingsStore & {
        setGrid: (partial: Partial<CanvasGridSettingsState>) => void;
    };
    environment: EnvironmentConfigStore;
    renderConfig: RenderConfigStore;
    rendererStats: RendererStats | null;
    setRendererStats: (stats: RendererStats) => void;
}

// Re-export individual slice types for backward compatibility
export type GridSlice = Pick<VisualSettingsSlice, 'grid'>;
export type EnvironmentSlice = Pick<VisualSettingsSlice, 'environment'>;
export type RenderConfigSlice = Pick<VisualSettingsSlice, 'renderConfig'>;
export type RendererStatsSlice = Pick<VisualSettingsSlice, 'rendererStats' | 'setRendererStats'>;

// ============================================================================
// Initial States
// ============================================================================
const GRID_INITIAL: CanvasGridSettingsState = {
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

const RENDER_CONFIG_INITIAL: RenderConfigState = {
    gl: GL_DEFAULT_CONFIG,
    orbitControls: ORBIT_CONTROLS_DEFAULT_CONFIG,
    SSAO: SSAO_DEFAULT_CONFIG
};

const RENDERER_STATS_INITIAL: RendererStats = {
    fps: 0,
    frameTime: 0,
    memory: { geometries: 0, textures: 0 },
    render: { calls: 0, triangles: 0, points: 0, lines: 0 }
};

// ============================================================================
// Slice Creator
// ============================================================================
export const createVisualSettingsSlice: StateCreator<any, [], [], VisualSettingsSlice> = (set) => ({
    // Grid settings with individual setters for backward compatibility + batch setter
    grid: {
        ...GRID_INITIAL,
        setGrid: (partial: Partial<CanvasGridSettingsState>) => set((s: VisualSettingsSlice) => ({ grid: { ...s.grid, ...partial } })),
        setEnabled: (enabled: boolean) => set((s: VisualSettingsSlice) => ({ grid: { ...s.grid, enabled } })),
        setInfiniteGrid: (infiniteGrid: boolean) => set((s: VisualSettingsSlice) => ({ grid: { ...s.grid, infiniteGrid } })),
        setCellSize: (cellSize: number) => set((s: VisualSettingsSlice) => ({ grid: { ...s.grid, cellSize } })),
        setSectionSize: (sectionSize: number) => set((s: VisualSettingsSlice) => ({ grid: { ...s.grid, sectionSize } })),
        setCellThickness: (cellThickness: number) => set((s: VisualSettingsSlice) => ({ grid: { ...s.grid, cellThickness } })),
        setSectionThickness: (sectionThickness: number) => set((s: VisualSettingsSlice) => ({ grid: { ...s.grid, sectionThickness } })),
        setFadeDistance: (fadeDistance: number) => set((s: VisualSettingsSlice) => ({ grid: { ...s.grid, fadeDistance } })),
        setFadeStrength: (fadeStrength: number) => set((s: VisualSettingsSlice) => ({ grid: { ...s.grid, fadeStrength } })),
        setSectionColor: (sectionColor: string) => set((s: VisualSettingsSlice) => ({ grid: { ...s.grid, sectionColor } })),
        setCellColor: (cellColor: string) => set((s: VisualSettingsSlice) => ({ grid: { ...s.grid, cellColor } })),
        setPosition: (position: [number, number, number]) => set((s: VisualSettingsSlice) => ({ grid: { ...s.grid, position } })),
        setRotation: (rotation: [number, number, number]) => set((s: VisualSettingsSlice) => ({ grid: { ...s.grid, rotation } })),
        reset: () => set((s: VisualSettingsSlice) => ({ grid: { ...s.grid, ...GRID_INITIAL } }))
    },

    // Environment settings
    environment: {
        ...ENVIRONMENT_DEFAULT_CONFIG,
        setBackgroundColor: (color: string) => set((s: VisualSettingsSlice) => ({ environment: { ...s.environment, backgroundColor: color } })),
        setBackgroundType: (type: 'color' | 'environment') => set((s: VisualSettingsSlice) => ({ environment: { ...s.environment, backgroundType: type } })),
        setEnvironmentPreset: (preset: string) => set((s: VisualSettingsSlice) => ({ environment: { ...s.environment, environmentPreset: preset } })),
        setFogConfig: (config: Record<string, unknown>) => set((s: VisualSettingsSlice) => ({ environment: { ...s.environment, ...config } })),
        setToneMappingExposure: (exposure: number) => set((s: VisualSettingsSlice) => ({ environment: { ...s.environment, toneMappingExposure: exposure } })),
        reset: () => set((s: VisualSettingsSlice) => ({ environment: { ...s.environment, ...ENVIRONMENT_DEFAULT_CONFIG } }))
    },

    // Render config
    renderConfig: {
        ...RENDER_CONFIG_INITIAL,
        reset: () => set((s: VisualSettingsSlice) => ({ renderConfig: { ...s.renderConfig, ...RENDER_CONFIG_INITIAL } }))
    },

    // Renderer stats
    rendererStats: RENDERER_STATS_INITIAL,
    setRendererStats: (stats: RendererStats) => set({ rendererStats: stats })
});
