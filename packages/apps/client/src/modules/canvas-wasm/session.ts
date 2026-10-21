import { AnalysisStatus } from '@/modules/fractal/contracts';
import { FrameJobGroupStatus } from '@volt/contracts/modules/jobs/domain';
import { Exporter } from '@volt/contracts/modules/plugin/enums';
import { isRenderableSceneExport } from '@/modules/canvas/utils/plugin-exposure-export';
import { ANALYSIS_EXECUTION_METADATA_KEY } from '@/modules/canvas/utils/selected-timestep-analysis';
import { WASM_TRAJECTORY_ID } from './constants';
import { hslToRgb } from './exporters/category-colors';
import { isExposureExported } from './run-pipeline';
import type {
    Analysis,
    AnalysisArtifactStatus,
    AnalysisExpectedArtifact,
    AnalysisStageStatus
} from '@volt/contracts/modules/analysis/domain';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import type { PipelineRun } from '@volt/contracts/modules/plugin/pipeline-run';
import type { FrameStatusIndex, LiveLogTarget } from '@/modules/canvas/utils/analysis-status-selectors';
import type { RenderableExposure } from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import type { SimulationCell } from '@volt/contracts/modules/simulation-cell/domain';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { AtomData } from '@/modules/trajectory/api/services/trajectory-service';
import type { TrajectoryFrame } from './read-trajectory';
import type { ShimTable } from './shim-table';

// Same derivation as the cluster's TrajectoryParserFactory (toFrameMetadata).
export const simulationCellFromFrame = (frame: TrajectoryFrame, trajectoryName: string): SimulationCell => {
    const now = new Date().toISOString();
    const [a, b, c] = frame.cellVectors;
    return {
        _id: `${WASM_TRAJECTORY_ID}-cell-${frame.timestep}`,
        createdAt: now,
        updatedAt: now,
        boundingBox: {
            width: Math.abs(a[0]),
            length: Math.abs(b[1]),
            height: Math.abs(c[2])
        },
        geometry: {
            cell_vectors: [a, b, c],
            cell_origin: frame.cellOrigin,
            periodic_boundary_conditions: { x: frame.pbc[0], y: frame.pbc[1], z: frame.pbc[2] }
        },
        team: 'wasm',
        trajectory: { _id: WASM_TRAJECTORY_ID, name: trajectoryName },
        timestep: frame.timestep
    };
};

export const buildTrajectory = (
    name: string,
    files: { count: number; totalSize: number },
    frames: TrajectoryFrame[],
    analyses: Analysis[]
): Trajectory => {
    const now = new Date().toISOString();
    return {
        _id: WASM_TRAJECTORY_ID,
        createdAt: now,
        updatedAt: now,
        name,
        team: 'wasm',
        folder: null,
        analysis: analyses,
        frames: frames.map((frame) => ({
            timestep: frame.timestep,
            natoms: frame.natoms,
            boxBounds: frame.box,
            simulationCell: simulationCellFromFrame(frame, name)
        })),
        framesCount: frames.length,
        atoms: frames[0]?.natoms ?? 0,
        firstTimestep: frames[0]?.timestep,
        stats: { totalFiles: files.count, totalSize: files.totalSize },
        status: 'completed',
        users: []
    };
};

// Trajectory columns first, then every column the plugin's atom table adds (rows are in atom_index order).
export const buildAtomRows = (frame: TrajectoryFrame, atoms: ShimTable | null): AtomData[] => {
    const extraColumns = (atoms?.columns ?? [])
        .map((column, index) => ({ name: column.name, index }))
        .filter(({ name }) => !['atom_index', 'id', 'x', 'y', 'z'].includes(name));

    return Array.from({ length: frame.natoms }, (_, index) => {
        const row: AtomData = {
            id: frame.ids?.[index] ?? index + 1,
            type: frame.types[index],
            x: frame.positions[index * 3],
            y: frame.positions[index * 3 + 1],
            z: frame.positions[index * 3 + 2]
        };
        const values = atoms?.rows[index];
        if (values) {
            for (const { name, index: column } of extraColumns) {
                row[name] = values[column];
            }
        }
        return row;
    });
};

// crypto.randomUUID only exists in secure contexts (HTTPS or localhost); LAN dev URLs lack it.
const createLocalId = (): string => (
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
);

const pluginName = (plugin: Plugin): string => plugin.modifier?.name?.trim() || plugin._id;

const EXPECTED_ARTIFACT_EXPORTERS = new Set<string>([Exporter.ATOMISTIC, Exporter.MESH, Exporter.LINE, Exporter.CHART]);

// Same as the server's resolveExpectedArtifacts: the primary artifact is the first 3D scene.
const resolveExpectedArtifacts = (plugin: Plugin, config: Record<string, unknown>): AnalysisExpectedArtifact[] => {
    const artifacts = (plugin.exposures ?? [])
        .filter((exposure) => EXPECTED_ARTIFACT_EXPORTERS.has(exposure.export?.exporter ?? ''))
        .filter((exposure) => isExposureExported(plugin, exposure, config))
        .map((exposure): AnalysisExpectedArtifact => ({
            exposureId: exposure._id,
            name: exposure.name || exposure._id,
            pluginId: plugin._id,
            exporter: exposure.export?.exporter,
            exportType: exposure.export?.type,
            status: 'pending'
        }));
    const primaryIndex = Math.max(0, artifacts.findIndex((artifact) => artifact.exportType === 'glb'));
    return artifacts.map((artifact, index) => ({ ...artifact, isPrimary: index === primaryIndex }));
};

// One entrypoint stage per timestep, which is how the execution overlay shows per-frame progress.
export const createWasmAnalysis = (
    plugin: Plugin,
    config: Record<string, unknown>,
    timesteps: number[],
    selectedTimesteps: number[] | undefined
): Analysis => {
    const now = new Date().toISOString();
    return {
        _id: createLocalId(),
        createdAt: now,
        updatedAt: now,
        plugin: plugin._id,
        pluginDisplayName: pluginName(plugin),
        config: selectedTimesteps
            ? { ...config, [ANALYSIS_EXECUTION_METADATA_KEY]: { selectedTimesteps } }
            : config,
        trajectory: { _id: WASM_TRAJECTORY_ID, name: 'Local dump' },
        totalFrames: timesteps.length,
        startedAt: now,
        status: AnalysisStatus.Pending,
        artifactStatus: 'pending',
        expectedArtifacts: resolveExpectedArtifacts(plugin, config),
        stages: timesteps.map((timestep) => ({
            stageKey: 'entrypoint',
            label: pluginName(plugin),
            type: 'entrypoint',
            status: 'pending',
            timestep,
            pluginId: plugin._id,
            pluginDisplayName: pluginName(plugin)
        }))
    };
};

// The cluster stores one PipelineRun per execution and the sidebar groups its analyses under it;
// /canvas/wasm keeps the same record in memory. Its config is what the user set, without the
// execution metadata added to the analysis, so "Restore into pipeline" rebuilds the same stages.
export const createWasmPipelineRun = (
    stages: { plugin: Plugin; config: Record<string, unknown> }[],
    analyses: Analysis[],
    selectedTimesteps: number[] | undefined
): PipelineRun => {
    const now = new Date().toISOString();
    return {
        _id: createLocalId(),
        createdAt: now,
        updatedAt: now,
        name: null,
        trajectory: WASM_TRAJECTORY_ID,
        team: '',
        selectedTimesteps: selectedTimesteps ?? [],
        stages: stages.map(({ plugin, config }, index) => ({
            index,
            kind: 'plugin',
            pluginId: plugin._id,
            pluginDisplayName: pluginName(plugin),
            config,
            analysisId: analyses[index]._id,
            cacheHit: false
        }))
    };
};

const TERMINAL_STATUSES: AnalysisStageStatus[] = ['completed', 'failed', 'cached'];

export const withFrameStatus = (
    analysis: Analysis,
    timestep: number,
    status: AnalysisStageStatus,
    detail?: string
): Analysis => {
    const now = new Date().toISOString();
    const stages = (analysis.stages ?? []).map((stage) => {
        if (stage.timestep !== timestep) return stage;
        const startedAt = status === 'running' ? now : stage.startedAt;
        return {
            ...stage,
            status,
            detail,
            startedAt,
            ...(TERMINAL_STATUSES.includes(status)
                ? { finishedAt: now, durationMs: startedAt ? Date.parse(now) - Date.parse(startedAt) : undefined }
                : {})
        };
    });

    const finished = stages.every((stage) => TERMINAL_STATUSES.includes(stage.status));
    const failed = stages.some((stage) => stage.status === 'failed');
    const analysisStatus = !finished
        ? AnalysisStatus.Running
        : failed ? AnalysisStatus.Failed : AnalysisStatus.Completed;
    const artifactStatus: AnalysisArtifactStatus = !finished ? 'generating' : failed ? 'failed' : 'ready';

    return {
        ...analysis,
        updatedAt: now,
        status: analysisStatus,
        finishedAt: finished ? now : undefined,
        artifactStatus,
        expectedArtifacts: analysis.expectedArtifacts?.map((artifact) => ({
            ...artifact,
            status: artifactStatus,
            ...(artifactStatus === 'ready' ? { produced: true, readyAt: now } : {})
        })),
        stages
    };
};

// The cluster derives per-frame status and the running frame from its jobs; /canvas/wasm has the
// same information in each analysis' per-timestep stages.
const STAGE_TO_FRAME_STATUS: Record<AnalysisStageStatus, FrameJobGroupStatus> = {
    pending: FrameJobGroupStatus.Queued,
    running: FrameJobGroupStatus.Running,
    completed: FrameJobGroupStatus.Completed,
    cached: FrameJobGroupStatus.Completed,
    failed: FrameJobGroupStatus.Failed
};

const AGGREGATE_PRECEDENCE: FrameJobGroupStatus[] = [
    FrameJobGroupStatus.Running,
    FrameJobGroupStatus.Queued,
    FrameJobGroupStatus.Failed,
    FrameJobGroupStatus.Completed
];

export const buildWasmFrameActivity = (analyses: readonly Analysis[]): {
    frameStatusIndex: FrameStatusIndex;
    running: LiveLogTarget[];
} => {
    const byTimestepAndAnalysis = new Map<number, Map<string, FrameJobGroupStatus>>();
    const running: LiveLogTarget[] = [];
    for (const analysis of analyses) {
        for (const stage of analysis.stages ?? []) {
            if (stage.timestep === undefined) continue;
            const status = STAGE_TO_FRAME_STATUS[stage.status];
            const perAnalysis = byTimestepAndAnalysis.get(stage.timestep) ?? new Map<string, FrameJobGroupStatus>();
            perAnalysis.set(analysis._id, status);
            byTimestepAndAnalysis.set(stage.timestep, perAnalysis);
            if (stage.status === 'running') {
                running.push({ analysisId: analysis._id, timestep: stage.timestep });
            }
        }
    }

    const aggregateByTimestep = new Map<number, FrameJobGroupStatus>();
    for (const [timestep, perAnalysis] of byTimestepAndAnalysis) {
        const statuses = new Set(perAnalysis.values());
        const aggregate = AGGREGATE_PRECEDENCE.find((status) => statuses.has(status));
        if (aggregate) aggregateByTimestep.set(timestep, aggregate);
    }
    return { frameStatusIndex: { aggregateByTimestep, byTimestepAndAnalysis }, running };
};

export const renderableExposuresFromPlugin = (
    plugin: Plugin,
    config: Record<string, unknown>,
    analysisId: string
): RenderableExposure[] => (
    (plugin.exposures ?? [])
        .filter((exposure) => isRenderableSceneExport(exposure.export) && isExposureExported(plugin, exposure, config))
        .map((exposure) => ({
            pluginId: plugin._id,
            analysisId,
            exposureId: exposure._id,
            name: exposure.name,
            icon: exposure.icon,
            results: exposure.results,
            canvas: true,
            export: exposure.export ?? undefined
        }))
);

// Default trajectory scene: one hue per LAMMPS atom type.
export const colorsFromTypes = (types: ArrayLike<number>, count: number): Float32Array => {
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
        const type = Number(types[index] ?? 1);
        colors.set(hslToRgb((type * 0.17) % 1, 0.55, 0.58), index * 3);
    }
    return colors;
};
