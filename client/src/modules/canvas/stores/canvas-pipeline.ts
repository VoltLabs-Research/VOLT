import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export type StageType =
    | 'slice-plane'
    | 'color-coding'
    | 'line-style'
    | 'expression-select'
    | 'analysis-plugin';

export interface SlicePlaneStageConfig {
    distance: number;
    normal: { x: number; y: number; z: number };
    reverseOrientation: boolean;
    visualizePlane: boolean;
}

export interface ColorCodingStageConfig {
    property?: string;
    propertyValue?: string;
    propertyType?: 'number' | 'string';
    exposureId?: string;
    gradient: string;
    manualRange?: { min: number; max: number };
    lastBakedKey?: string;
    runStatus?: AnalysisPluginRunStatus;
}

export interface ExpressionSelectStageConfig {
    expression: string;
}

export interface LineStyleStageConfig {
    lastBakedKey?: string;
}

export type AnalysisPluginRunStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AnalysisPluginStageConfig {
    pluginId: string;
    argValues: Record<string, unknown>;
    selectedTeamClusterId?: string;
    selectedTimesteps?: number[];
    lastAnalysisId?: string;
    runStatus?: AnalysisPluginRunStatus;
}

export type StageConfig =
    | SlicePlaneStageConfig
    | ColorCodingStageConfig
    | LineStyleStageConfig
    | ExpressionSelectStageConfig
    | AnalysisPluginStageConfig;

export const DEFAULT_SLICE_PLANE_STAGE_CONFIG: SlicePlaneStageConfig = {
    distance: 0,
    normal: { x: 1, y: 0, z: 0 },
    reverseOrientation: false,
    visualizePlane: false
};

export const DEFAULT_COLOR_CODING_STAGE_CONFIG: ColorCodingStageConfig = {
    gradient: 'Viridis'
};

export const DEFAULT_LINE_STYLE_STAGE_CONFIG: LineStyleStageConfig = {};

export interface PipelineStage {
    id: string;
    type: StageType;
    config: StageConfig;
    enabled: boolean;
    executed?: boolean;
}

const EMPTY_STAGES: PipelineStage[] = [];

interface CanvasPipelineStore {
    activeTrajectoryId: string | null;
    byTrajectory: Record<string, PipelineStage[]>;
    setActiveTrajectory: (trajectoryId: string | null) => void;
    addStage: (type: StageType, config: StageConfig, trajectoryId?: string) => string | null;
    removeStage: (id: string, trajectoryId?: string) => void;
    reorderStage: (id: string, newIndex: number, trajectoryId?: string) => void;
    updateStageConfig: (id: string, config: Partial<StageConfig>, trajectoryId?: string) => void;
    toggleStageEnabled: (id: string, trajectoryId?: string) => void;
    markStagesExecuted: (ids: string[], trajectoryId?: string) => void;
    clearAll: (trajectoryId?: string) => void;
}

export const useCanvasPipelineStore = create<CanvasPipelineStore>()(
    persist(
        (set, get) => {
            const resolveTrajectoryId = (trajectoryId?: string): string | null =>
                trajectoryId ?? get().activeTrajectoryId;

            return {
                activeTrajectoryId: null,
                byTrajectory: {},

                setActiveTrajectory: (trajectoryId) => set({ activeTrajectoryId: trajectoryId }),

                addStage: (type, config, trajectoryId) => {
                    const target = resolveTrajectoryId(trajectoryId);
                    if (!target) return null;

                    const id = uuidv4();
                    set((state) => ({
                        byTrajectory: {
                            ...state.byTrajectory,
                            [target]: [...(state.byTrajectory[target] ?? EMPTY_STAGES), { id, type, config, enabled: true, executed: false }]
                        }
                    }));
                    return id;
                },

                removeStage: (id, trajectoryId) => {
                    const target = resolveTrajectoryId(trajectoryId);
                    if (!target) return;
                    set((state) => ({
                        byTrajectory: {
                            ...state.byTrajectory,
                            [target]: (state.byTrajectory[target] ?? EMPTY_STAGES).filter((stage) => stage.id !== id)
                        }
                    }));
                },

                reorderStage: (id, newIndex, trajectoryId) => {
                    const target = resolveTrajectoryId(trajectoryId);
                    if (!target) return;
                    const stages = get().byTrajectory[target] ?? EMPTY_STAGES;
                    const fromIndex = stages.findIndex((stage) => stage.id === id);
                    if (fromIndex === -1) return;
                    const next = [...stages];
                    const [item] = next.splice(fromIndex, 1);
                    next.splice(newIndex, 0, item);
                    set((state) => ({
                        byTrajectory: { ...state.byTrajectory, [target]: next }
                    }));
                },

                updateStageConfig: (id, config, trajectoryId) => {
                    const target = resolveTrajectoryId(trajectoryId);
                    if (!target) return;
                    set((state) => ({
                        byTrajectory: {
                            ...state.byTrajectory,
                            [target]: (state.byTrajectory[target] ?? EMPTY_STAGES).map((stage) =>
                                stage.id === id ? { ...stage, config: { ...stage.config, ...config } } : stage
                            )
                        }
                    }));
                },

                toggleStageEnabled: (id, trajectoryId) => {
                    const target = resolveTrajectoryId(trajectoryId);
                    if (!target) return;
                    set((state) => ({
                        byTrajectory: {
                            ...state.byTrajectory,
                            [target]: (state.byTrajectory[target] ?? EMPTY_STAGES).map((stage) =>
                                stage.id === id ? { ...stage, enabled: !stage.enabled } : stage
                            )
                        }
                    }));
                },

                markStagesExecuted: (ids, trajectoryId) => {
                    const target = resolveTrajectoryId(trajectoryId);
                    if (!target) return;
                    const idSet = new Set(ids);
                    set((state) => ({
                        byTrajectory: {
                            ...state.byTrajectory,
                            [target]: (state.byTrajectory[target] ?? EMPTY_STAGES).map((stage) =>
                                idSet.has(stage.id) ? { ...stage, executed: true } : stage
                            )
                        }
                    }));
                },

                clearAll: (trajectoryId) => {
                    const target = resolveTrajectoryId(trajectoryId);
                    if (!target) return;
                    set((state) => ({
                        byTrajectory: { ...state.byTrajectory, [target]: [] }
                    }));
                }
            };
        },
        {
            name: 'volt-canvas-pipeline',
            partialize: (state) => ({ byTrajectory: state.byTrajectory })
        }
    )
);

export const useStages = (trajectoryId?: string): PipelineStage[] =>
    useCanvasPipelineStore((state) => {
        const target = trajectoryId ?? state.activeTrajectoryId;
        return target ? state.byTrajectory[target] ?? EMPTY_STAGES : EMPTY_STAGES;
    });

export const ORDERED_PIPELINE_STAGE_TYPES: ReadonlySet<StageType> = new Set<StageType>([
    'slice-plane',
    'expression-select',
    'analysis-plugin'
]);

export const isOrderedPipelineStage = (stage: PipelineStage): boolean =>
    ORDERED_PIPELINE_STAGE_TYPES.has(stage.type);

export type PipelineStageKind = 'plugin' | 'slice' | 'expression';

export const stageTypeToPipelineKind = (type: StageType): PipelineStageKind | null => {
    switch (type) {
        case 'analysis-plugin':
            return 'plugin';
        case 'slice-plane':
            return 'slice';
        case 'expression-select':
            return 'expression';
        default:
            return null;
    }
};

export interface SliceStageEntry {
    id: string;
    config: SlicePlaneStageConfig;
}

export const collectEnabledSliceStages = (stages: PipelineStage[]): SliceStageEntry[] =>
    stages
        .filter((stage) => stage.type === 'slice-plane' && stage.enabled)
        .map((stage) => ({ id: stage.id, config: stage.config as SlicePlaneStageConfig }));

export const useActiveTrajectoryStages = (): PipelineStage[] =>
    useCanvasPipelineStore((state) =>
        state.activeTrajectoryId ? state.byTrajectory[state.activeTrajectoryId] ?? EMPTY_STAGES : EMPTY_STAGES
    );
