import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { PipelineStageKind } from '@volt/contracts/modules/plugin/http';

export type StageType =
    | 'slice-plane'
    | 'color-coding'
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
}

export type ExpressionSelectAction = 'color' | 'delete';

export interface ExpressionSelectStageConfig {
    expression: string;
    
    
    
    
    action?: ExpressionSelectAction;
    
    color?: string;
}

export interface AnalysisPluginStageConfig {
    pluginId: string;
    argValues: Record<string, unknown>;
    selectedTeamClusterId?: string;
    selectedTimesteps?: number[];
}

export type StageConfig =
    | SlicePlaneStageConfig
    | ColorCodingStageConfig
    | ExpressionSelectStageConfig
    | AnalysisPluginStageConfig;

export const DEFAULT_SLICE_PLANE_STAGE_CONFIG: SlicePlaneStageConfig = {
    distance: 0,
    normal: {
        x: 1,
        y: 0,
        z: 0
    },
    reverseOrientation: false,
    visualizePlane: false
};

export const DEFAULT_COLOR_CODING_STAGE_CONFIG: ColorCodingStageConfig = {
    gradient: 'Viridis'
};

export const DEFAULT_EXPRESSION_SELECT_COLOR = '#fbbf24';

export const DEFAULT_EXPRESSION_SELECT_STAGE_CONFIG: ExpressionSelectStageConfig = {
    expression: '',
    action: 'color',
    color: DEFAULT_EXPRESSION_SELECT_COLOR
};

export interface PipelineStage {
    id: string;
    type: StageType;
    config: StageConfig;
    enabled: boolean;
    executed?: boolean;
}

const EMPTY_STAGES: PipelineStage[] = [];

// Stages are kept per pipeline: the draft under the trajectory's id, and the stages added to a saved
// run under `${trajectoryId}::${runId}` until that run executes them.
export const pipelineStoreKey = (trajectoryId: string, runId?: string): string =>
    runId ? `${trajectoryId}::${runId}` : trajectoryId;

// The saved run a key belongs to, or undefined for the trajectory's draft.
export const pipelineRunIdOf = (trajectoryId: string, key: string | undefined): string | undefined => {
    const prefix = `${trajectoryId}::`;
    return key?.startsWith(prefix) ? key.slice(prefix.length) : undefined;
};

interface CanvasPipelineStore {
    // The key of the pipeline the canvas shows; stage calls without a key go to it.
    activeTrajectoryId: string | null;
    byTrajectory: Record<string, PipelineStage[]>;
    activeKeyByTrajectory: Record<string, string>;
    setActiveTrajectory: (trajectoryId: string | null) => void;
    setActivePipeline: (trajectoryId: string, runId?: string) => void;
    clearStages: (key: string) => void;
    // Parameters changed on a saved run's stages, by stage index, under the run's key. Running them
    // makes a new pipeline; the saved run keeps what it ran with.
    stageEditsByKey: Record<string, Record<number, Record<string, unknown>>>;
    setStageEdit: (key: string, stageIndex: number, config: Record<string, unknown>) => void;
    clearStageEdit: (key: string, stageIndex: number) => void;
    clearStageEdits: (key: string) => void;
    addStage: (type: StageType, config: StageConfig, trajectoryId?: string) => string | null;
    removeStage: (id: string, trajectoryId?: string) => void;
    reorderStage: (id: string, newIndex: number, trajectoryId?: string) => void;
    updateStageConfig: (id: string, config: Partial<StageConfig>, trajectoryId?: string) => void;
    toggleStageEnabled: (id: string, trajectoryId?: string) => void;
    markStagesExecuted: (ids: string[], trajectoryId?: string) => void;
    replaceStages: (stages: NewStage[], trajectoryId?: string) => void;
}

export interface NewStage {
    type: StageType;
    config: StageConfig;
}

export const useCanvasPipelineStore = create<CanvasPipelineStore>()(
    persist(
        (set, get) => {
            const resolveTrajectoryId = (trajectoryId?: string): string | null =>
                trajectoryId ?? get().activeTrajectoryId;

            return {
                activeTrajectoryId: null,
                byTrajectory: {},
                activeKeyByTrajectory: {},

                setActiveTrajectory: (trajectoryId) => set({ activeTrajectoryId: trajectoryId }),

                setActivePipeline: (trajectoryId, runId) => {
                    const key = pipelineStoreKey(trajectoryId, runId);
                    set((state) => ({
                        activeTrajectoryId: key,
                        activeKeyByTrajectory: {
                            ...state.activeKeyByTrajectory,
                            [trajectoryId]: key
                        }
                    }));
                },

                stageEditsByKey: {},

                setStageEdit: (key, stageIndex, config) => {
                    set((state) => ({
                        stageEditsByKey: {
                            ...state.stageEditsByKey,
                            [key]: {
                                ...state.stageEditsByKey[key],
                                [stageIndex]: config
                            }
                        }
                    }));
                },

                clearStageEdit: (key, stageIndex) => {
                    set((state) => {
                        const edits = state.stageEditsByKey[key];
                        if (!edits || !(stageIndex in edits)) return state;
                        const { [stageIndex]: _removed, ...rest } = edits;
                        return {
                            stageEditsByKey: {
                                ...state.stageEditsByKey,
                                [key]: rest
                            }
                        };
                    });
                },

                clearStageEdits: (key) => {
                    set((state) => {
                        if (!(key in state.stageEditsByKey)) return state;
                        const { [key]: _removed, ...rest } = state.stageEditsByKey;
                        return { stageEditsByKey: rest };
                    });
                },

                clearStages: (key) => {
                    set((state) => {
                        if (!(key in state.byTrajectory)) return state;
                        const { [key]: _removed, ...rest } = state.byTrajectory;
                        return { byTrajectory: rest };
                    });
                },

                addStage: (type, config, trajectoryId) => {
                    const target = resolveTrajectoryId(trajectoryId);
                    if (!target) return null;

                    const id = uuidv4();
                    set((state) => ({
                        byTrajectory: {
                            ...state.byTrajectory,
                            [target]: [...(state.byTrajectory[target] ?? EMPTY_STAGES), {
                                id,
                                type,
                                config,
                                enabled: true,
                                executed: false
                            }]
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
                        byTrajectory: {
                            ...state.byTrajectory,
                            [target]: next
                        }
                    }));
                },

                updateStageConfig: (id, config, trajectoryId) => {
                    const target = resolveTrajectoryId(trajectoryId);
                    if (!target) return;
                    set((state) => ({
                        byTrajectory: {
                            ...state.byTrajectory,
                            [target]: (state.byTrajectory[target] ?? EMPTY_STAGES).map((stage) =>
                                stage.id === id ? {
                                    ...stage,
                                    config: {
                                        ...stage.config,
                                        ...config
                                    }
                                } : stage
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
                                stage.id === id ? {
                                    ...stage,
                                    enabled: !stage.enabled
                                } : stage
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
                                idSet.has(stage.id) ? {
                                    ...stage,
                                    executed: true
                                } : stage
                            )
                        }
                    }));
                },

                replaceStages: (stages, trajectoryId) => {
                    const target = resolveTrajectoryId(trajectoryId);
                    if (!target) return;
                    set((state) => ({
                        byTrajectory: {
                            ...state.byTrajectory,
                            [target]: stages.map((stage) => ({
                                id: uuidv4(),
                                type: stage.type,
                                config: stage.config,
                                enabled: true,
                                executed: false
                            }))
                        }
                    }));
                }
            };
        },
        {
            name: 'volt-canvas-pipeline',
            partialize: (state) => ({
                byTrajectory: state.byTrajectory,
                stageEditsByKey: state.stageEditsByKey
            })
        }
    )
);

export const useStages = (trajectoryId?: string): PipelineStage[] =>
    useCanvasPipelineStore((state) => {
        const target = trajectoryId ?? state.activeTrajectoryId;
        return target ? state.byTrajectory[target] ?? EMPTY_STAGES : EMPTY_STAGES;
    });

const ORDERED_PIPELINE_STAGE_TYPES: ReadonlySet<StageType> = new Set<StageType>([
    'slice-plane',
    'expression-select',
    'analysis-plugin'
]);

export const isOrderedPipelineStage = (stage: PipelineStage): boolean =>
    ORDERED_PIPELINE_STAGE_TYPES.has(stage.type);

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

interface SliceStageEntry {
    id: string;
    config: SlicePlaneStageConfig;
}

export const collectEnabledSliceStages = (stages: PipelineStage[]): SliceStageEntry[] =>
    stages
        .filter((stage) => stage.type === 'slice-plane' && stage.enabled)
        .map((stage) => ({
            id: stage.id,
            config: stage.config as SlicePlaneStageConfig
        }));

const EMPTY_EDITS: Record<number, Record<string, unknown>> = {};

export const useStageEdits = (key?: string): Record<number, Record<string, unknown>> =>
    useCanvasPipelineStore((state) => (key ? state.stageEditsByKey[key] : undefined) ?? EMPTY_EDITS);

// The stages of the pipeline the canvas shows for this trajectory, for what renders them.
export const useActivePipelineStages = (trajectoryId?: string): PipelineStage[] =>
    useCanvasPipelineStore((state) => {
        if (!trajectoryId) return EMPTY_STAGES;
        const key = state.activeKeyByTrajectory[trajectoryId] ?? trajectoryId;
        return state.byTrajectory[key] ?? EMPTY_STAGES;
    });

export const useActiveTrajectoryStages = (): PipelineStage[] =>
    useCanvasPipelineStore((state) =>
        state.activeTrajectoryId ? state.byTrajectory[state.activeTrajectoryId] ?? EMPTY_STAGES : EMPTY_STAGES
    );
