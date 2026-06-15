import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

// Single OVITO-style pipeline that lives in the canvas right panel. A stage is
// either a client-instant View transform (slice / color / expression — evaluated
// in-browser against the columnar atom buffer) or an analysis-plugin stage (a
// heavy cluster job that bakes an immutable result the downstream client stages
// then read via the active analysisId). The two kinds share one reorderable list.
export type StageType =
    | 'slice-plane'
    | 'color-coding'
    | 'expression-select'
    | 'analysis-plugin';

export interface SlicePlaneStageConfig {
    // Per-stage clip-plane geometry (the editor store no longer holds slice state).
    // The stage's own `enabled` flag gates whether this plane contributes — there is
    // no separate inner enabled flag.
    distance: number;
    normal: { x: number; y: number; z: number };
    reverseOrientation: boolean;
    visualizePlane: boolean;
}

export interface ColorCodingStageConfig {
    // Backend bake config. property/range/gradient are POSTed to the daemon, which
    // bakes a colored GLB scene; the client never fetches the full property column.
    property?: string;
    propertyValue?: string;
    propertyType?: 'number' | 'string';
    exposureId?: string;
    gradient: string;
    // Manual [min,max]; when absent the daemon computes the range from the parquet.
    manualRange?: { min: number; max: number };
    lastBakedKey?: string;
    runStatus?: AnalysisPluginRunStatus;
}

export interface ExpressionSelectStageConfig {
    expression: string;
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
    | ExpressionSelectStageConfig
    | AnalysisPluginStageConfig;

// Default config when a stage is first added from the "+ Add" menu.
export const DEFAULT_SLICE_PLANE_STAGE_CONFIG: SlicePlaneStageConfig = {
    distance: 0,
    normal: { x: 1, y: 0, z: 0 },
    reverseOrientation: false,
    visualizePlane: false
};

export const DEFAULT_COLOR_CODING_STAGE_CONFIG: ColorCodingStageConfig = {
    gradient: 'Viridis'
};

export interface PipelineStage {
    id: string;
    type: StageType;
    config: StageConfig;
    enabled: boolean;
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
    clearAll: (trajectoryId?: string) => void;
}

export const useCanvasPipelineStore = create<CanvasPipelineStore>()(
    persist(
        (set, get) => {
            // Resolve the target trajectory for a mutation: explicit arg wins, else
            // the active trajectory the mounted panel registered.
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
                            [target]: [...(state.byTrajectory[target] ?? EMPTY_STAGES), { id, type, config, enabled: true }]
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

// Selector helper: the stages for one trajectory, stable empty array when none.
export const useStages = (trajectoryId?: string): PipelineStage[] =>
    useCanvasPipelineStore((state) => (trajectoryId ? state.byTrajectory[trajectoryId] ?? EMPTY_STAGES : EMPTY_STAGES));

// Enabled slice-plane stages (id + config) for a trajectory — drives the engine
// clipping planes and the visualization helpers. Returns the trajectory's stage
// array reference (stable from the store); callers filter/map under useMemo.
export interface SliceStageEntry {
    id: string;
    config: SlicePlaneStageConfig;
}

export const collectEnabledSliceStages = (stages: PipelineStage[]): SliceStageEntry[] =>
    stages
        .filter((stage) => stage.type === 'slice-plane' && stage.enabled)
        .map((stage) => ({ id: stage.id, config: stage.config as SlicePlaneStageConfig }));

// Reactive: the active trajectory's stage array (used by the visualization helper,
// which is mounted without a trajectoryId prop).
export const useActiveTrajectoryStages = (): PipelineStage[] =>
    useCanvasPipelineStore((state) =>
        state.activeTrajectoryId ? state.byTrajectory[state.activeTrajectoryId] ?? EMPTY_STAGES : EMPTY_STAGES
    );
