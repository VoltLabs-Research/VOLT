import { create } from 'zustand';
import { loadWasmCatalog } from './catalog';
import { WASM_SAMPLE_DUMP_URL } from './constants';
import { buildPointCloudGlb } from './exporters/glb';
import { frameBytes, readTrajectoryFiles } from './read-trajectory';
import { collectFrameResult, runPipelineStage } from './run-pipeline';
import { runPluginInWorker } from './run-plugin';
import {
    colorsFromTypes,
    createWasmAnalysis,
    createWasmPipelineRun,
    renderableExposuresFromPlugin,
    simulationCellFromFrame,
    withFrameStatus
} from './session';
import type { Analysis, AnalysisStageStatus } from '@volt/contracts/modules/analysis/domain';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import type { PipelineRun } from '@volt/contracts/modules/plugin/pipeline-run';
import type { RenderableExposure } from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import type { SimulationCell } from '@volt/contracts/modules/simulation-cell/domain';
import type { LoadedTrajectory, SkippedFile, TrajectoryFrame } from './read-trajectory';
import type { FileWithPath } from '@/shared/utils/file';
import type { FrameContext, FrameResult, ListingResult, PluginExecutor } from './run-pipeline';
import type { ShimTable } from './shim-table';

export interface WasmFrameRecord {
    atoms: ShimTable | null;
    listings: Record<string, ListingResult>;
    // exposure _id -> object URL of the GLB built by that exposure's exporter.
    scenes: Record<string, string>;
}

export interface WasmAnalysisRecord {
    exposures: RenderableExposure[];
    frames: Record<number, WasmFrameRecord>;
}

export interface WasmPipelineStageInput {
    plugin: Plugin;
    config: Record<string, unknown>;
}

export interface WasmPipelineRequest {
    stages: WasmPipelineStageInput[];
    timesteps: number[];
    // Recorded on the analyses when only part of the trajectory runs, like the cluster does.
    selectedTimesteps?: number[];
    onStarted?: (analyses: Analysis[]) => void;
    execute?: PluginExecutor;
}

export interface WasmPipelineRun {
    analyses: Analysis[];
    failures: string[];
    // Where the first plugin actually failed (later stages of that frame are only skipped).
    firstFailure: { analysisId: string; timestep: number } | null;
    // Another trajectory was opened while it ran; nothing it produced was kept.
    cancelled: boolean;
}

export interface WasmLoadRequest {
    // What the trajectory is called: the folder, or the file when only one was chosen.
    name: string;
    files: FileWithPath[];
}

// What was left out of a successful load, for the caller to report.
export interface WasmLoadReport {
    skipped: SkippedFile[];
    duplicateTimesteps: number;
}

const MAX_LOG_LINES = 5000;

interface WasmCanvasState {
    // Bumped whenever another trajectory is opened. /canvas/wasm uses one trajectory id for every
    // file, so the canvas resets its per-trajectory state (scenes, URL, sidebar) on this instead.
    sessionId: number;
    trajectoryName: string | null;
    totalSize: number;
    // The files the frames come from, as they are on disk; every frame is a byte range of one of them.
    files: Uint8Array[];
    frames: TrajectoryFrame[];
    simulationCells: Record<number, SimulationCell>;
    baseGlb: { timestep: number; url: string } | null;
    isParsing: boolean;
    // What is being read, and the last thing that could not be loaded (with parseError).
    parsingFileName: string | null;
    failedFileName: string | null;
    parseError: string | null;
    isRunning: boolean;
    analyses: Analysis[];
    // One per runPipeline call, newest first; the sidebar groups the analyses under them.
    pipelineRuns: PipelineRun[];
    records: Record<string, WasmAnalysisRecord>;
    // analysisId -> timestep -> plugin stdout/stderr lines.
    logs: Record<string, Record<number, string[]>>;
    // Null when nothing could be loaded; parseError says why.
    loadTrajectoryFiles: (request: WasmLoadRequest) => Promise<WasmLoadReport | null>;
    loadSampleDump: () => Promise<WasmLoadReport | null>;
    showFrame: (timestep: number) => void;
    runPipeline: (request: WasmPipelineRequest) => Promise<WasmPipelineRun>;
    removeAnalysis: (analysisId: string) => void;
    renamePipelineRun: (runId: string, name: string) => void;
    removePipelineRun: (runId: string) => void;
}

const emptySession = {
    trajectoryName: null,
    totalSize: 0,
    files: [] as Uint8Array[],
    frames: [] as TrajectoryFrame[],
    simulationCells: {} as Record<number, SimulationCell>,
    baseGlb: null,
    parseError: null,
    failedFileName: null,
    analyses: [] as Analysis[],
    pipelineRuns: [] as PipelineRun[],
    records: {} as Record<string, WasmAnalysisRecord>,
    logs: {} as Record<string, Record<number, string[]>>
};

const describeUnreadable = (skipped: SkippedFile[]): string => {
    if (skipped.length === 0) return 'There are no files to read.';
    if (skipped.length === 1) return skipped[0].reason;
    return `None of the ${skipped.length} files is a trajectory VOLT can read.`;
};

const createFrameGlbUrl = (frame: TrajectoryFrame): string =>
    URL.createObjectURL(buildPointCloudGlb(frame.positions, colorsFromTypes(frame.types, frame.natoms)));

const revokeRecordGlbs = (record: WasmAnalysisRecord | undefined) => {
    Object.values(record?.frames ?? {}).forEach((frame) => {
        Object.values(frame.scenes).forEach((url) => URL.revokeObjectURL(url));
    });
};

const toFrameRecord = (result: FrameResult): WasmFrameRecord => ({
    atoms: result.atoms,
    listings: result.listings,
    scenes: Object.fromEntries(Object.entries(result.scenes).map(([exposureId, glb]) => [exposureId, URL.createObjectURL(glb)]))
});

export const useWasmCanvasStore = create<WasmCanvasState>((set, get) => {
    // The pipeline that is running, if any; opening another trajectory cancels it.
    let activeRun: AbortController | null = null;

    const patchAnalysis = (analysisId: string, timestep: number, status: AnalysisStageStatus, detail?: string) => {
        set((state) => ({
            analyses: state.analyses.map((analysis) => (
                analysis._id === analysisId ? withFrameStatus(analysis, timestep, status, detail) : analysis
            ))
        }));
    };

    const appendLog = (analysisId: string, timestep: number, line: string) => {
        set((state) => {
            const lines = state.logs[analysisId]?.[timestep] ?? [];
            if (lines.length >= MAX_LOG_LINES) return state;
            return {
                logs: {
                    ...state.logs,
                    [analysisId]: { ...state.logs[analysisId], [timestep]: [...lines, line] }
                }
            };
        });
    };

    const setFrameRecord = (analysisId: string, timestep: number, frameRecord: WasmFrameRecord) => {
        set((state) => {
            const record = state.records[analysisId];
            if (!record) return state;
            return {
                records: {
                    ...state.records,
                    [analysisId]: { ...record, frames: { ...record.frames, [timestep]: frameRecord } }
                }
            };
        });
    };

    // Something that fails to load never replaces the trajectory already on screen.
    const failLoad = (name: string, message: string): null => {
        set({ isParsing: false, parsingFileName: null, parseError: message, failedFileName: name });
        return null;
    };

    return {
        ...emptySession,
        sessionId: 0,
        isParsing: false,
        parsingFileName: null,
        isRunning: false,

        async loadTrajectoryFiles({ name, files }) {
            set({ isParsing: true, parsingFileName: name, parseError: null });
            let trajectory: LoadedTrajectory;
            try {
                trajectory = await readTrajectoryFiles(files);
            } catch (error) {
                return failLoad(name, error instanceof Error ? error.message : 'The files could not be read.');
            }
            const { frames } = trajectory;
            if (frames.length === 0) {
                return failLoad(name, describeUnreadable(trajectory.skipped));
            }

            activeRun?.abort();
            activeRun = null;
            const previous = get();
            Object.values(previous.records).forEach(revokeRecordGlbs);
            if (previous.baseGlb) URL.revokeObjectURL(previous.baseGlb.url);
            set({
                ...emptySession,
                sessionId: previous.sessionId + 1,
                isRunning: false,
                trajectoryName: name,
                totalSize: trajectory.totalSize,
                files: trajectory.files,
                frames,
                simulationCells: Object.fromEntries(frames.map((frame) => [
                    frame.timestep,
                    simulationCellFromFrame(frame, name)
                ])),
                isParsing: false,
                parsingFileName: null
            });
            get().showFrame(frames[0].timestep);
            return { skipped: trajectory.skipped, duplicateTimesteps: trajectory.duplicateTimesteps };
        },

        async loadSampleDump() {
            const fileName = WASM_SAMPLE_DUMP_URL.split('/').pop() ?? 'sample.dump';
            set({ isParsing: true, parsingFileName: fileName, parseError: null });
            try {
                const response = await fetch(WASM_SAMPLE_DUMP_URL);
                if (!response.ok) {
                    throw new Error(`The sample could not be downloaded (${response.status}).`);
                }
                const file = new File([await response.blob()], fileName);
                return await get().loadTrajectoryFiles({ name: fileName, files: [{ file, path: fileName }] });
            } catch (error) {
                return failLoad(fileName, error instanceof Error ? error.message : 'The sample could not be downloaded.');
            }
        },

        showFrame(timestep) {
            const { baseGlb, frames } = get();
            const frame = frames.find((candidate) => candidate.timestep === timestep);
            if (!frame || baseGlb?.timestep === timestep) return;
            if (baseGlb) URL.revokeObjectURL(baseGlb.url);
            set({ baseGlb: { timestep, url: createFrameGlbUrl(frame) } });
        },

        async runPipeline({ stages, timesteps, selectedTimesteps, onStarted, execute = runPluginInWorker }) {
            const controller = new AbortController();
            activeRun?.abort();
            activeRun = controller;
            const isCancelled = () => controller.signal.aborted;
            const cancelledRun: WasmPipelineRun = { analyses: [], failures: [], firstFailure: null, cancelled: true };
            const executeCancellable: PluginExecutor = (execution) => execute({ ...execution, signal: controller.signal });

            const { files, frames } = get();
            const frameByTimestep = new Map(frames.map((frame) => [frame.timestep, frame]));
            const frameAt = (timestep: number): TrajectoryFrame => {
                const frame = frameByTimestep.get(timestep);
                if (!frame) throw new Error(`Timestep ${timestep} is not in the uploaded file.`);
                return frame;
            };
            const frameDump = (timestep: number): Uint8Array => frameBytes(files, frameAt(timestep));
            timesteps.forEach(frameAt);

            const { runtimeById } = await loadWasmCatalog();
            if (isCancelled()) return cancelledRun;
            const pipeline = stages.map(({ plugin, config }) => {
                const runtime = runtimeById.get(plugin._id);
                if (!runtime) throw new Error(`${plugin.modifier?.name ?? plugin._id} has no WASM build.`);
                return { runtime, config };
            });
            const created = pipeline.map(({ runtime, config }) => (
                createWasmAnalysis(runtime.plugin, config, timesteps, selectedTimesteps)
            ));
            const pipelineRun = createWasmPipelineRun(
                pipeline.map(({ runtime, config }) => ({ plugin: runtime.plugin, config })),
                created,
                selectedTimesteps
            );
            const analyses = created.map((analysis) => ({ ...analysis, pipelineRunId: pipelineRun._id }));

            set((state) => ({
                isRunning: true,
                analyses: [...analyses, ...state.analyses],
                pipelineRuns: [pipelineRun, ...state.pipelineRuns],
                records: {
                    ...state.records,
                    ...Object.fromEntries(analyses.map((analysis, index) => [analysis._id, {
                        exposures: renderableExposuresFromPlugin(pipeline[index].runtime.plugin, pipeline[index].config, analysis._id),
                        frames: {}
                    }]))
                }
            }));
            onStarted?.(analyses);

            const failures: string[] = [];
            let firstFailure: WasmPipelineRun['firstFailure'] = null;
            try {
                for (const timestep of timesteps) {
                    if (isCancelled()) break;
                    const frame = frameAt(timestep);
                    const context: FrameContext = { workingDump: frameBytes(files, frame), shared: {} };
                    let skippedBecause: string | null = null;

                    for (const [index, stage] of pipeline.entries()) {
                        if (isCancelled()) break;
                        const analysisId = analyses[index]._id;
                        const name = analyses[index].pluginDisplayName;
                        if (skippedBecause) {
                            appendLog(analysisId, timestep, skippedBecause);
                            patchAnalysis(analysisId, timestep, 'failed', skippedBecause);
                            continue;
                        }

                        patchAnalysis(analysisId, timestep, 'running');
                        try {
                            const outputs = await runPipelineStage(
                                stage,
                                context,
                                frameDump,
                                executeCancellable,
                                (line) => {
                                    if (!isCancelled()) appendLog(analysisId, timestep, line);
                                }
                            );
                            if (isCancelled()) break;
                            setFrameRecord(analysisId, timestep, toFrameRecord(collectFrameResult(
                                stage.runtime.plugin,
                                stage.config,
                                outputs,
                                frame.natoms
                            )));
                            patchAnalysis(analysisId, timestep, 'completed');
                        } catch (error) {
                            if (isCancelled()) break;
                            const message = error instanceof Error ? error.message : String(error);
                            appendLog(analysisId, timestep, `Failed: ${message}`);
                            patchAnalysis(analysisId, timestep, 'failed', message);
                            failures.push(`${name} (timestep ${timestep}): ${message}`);
                            firstFailure ??= { analysisId, timestep };
                            skippedBecause = `Skipped because ${name} failed on this frame.`;
                        }
                    }
                }
            } finally {
                if (activeRun === controller) {
                    activeRun = null;
                    set({ isRunning: false });
                }
            }

            if (isCancelled()) return cancelledRun;
            const finished = new Set(analyses.map((analysis) => analysis._id));
            return {
                analyses: get().analyses.filter((analysis) => finished.has(analysis._id)),
                failures,
                firstFailure,
                cancelled: false
            };
        },

        removeAnalysis(analysisId) {
            set((state) => {
                revokeRecordGlbs(state.records[analysisId]);
                const { [analysisId]: _removedRecord, ...records } = state.records;
                const { [analysisId]: _removedLogs, ...logs } = state.logs;
                // Its stage leaves the run with it; a run left without stages is gone too.
                const pipelineRuns = state.pipelineRuns
                    .map((run) => ({ ...run, stages: run.stages.filter((stage) => stage.analysisId !== analysisId) }))
                    .filter((run) => run.stages.length > 0);
                return {
                    analyses: state.analyses.filter((analysis) => analysis._id !== analysisId),
                    pipelineRuns,
                    records,
                    logs
                };
            });
        },

        renamePipelineRun(runId, name) {
            const trimmed = name.trim();
            set((state) => ({
                pipelineRuns: state.pipelineRuns.map((run) => (
                    run._id === runId ? { ...run, name: trimmed || null, updatedAt: new Date().toISOString() } : run
                ))
            }));
        },

        removePipelineRun(runId) {
            set((state) => ({ pipelineRuns: state.pipelineRuns.filter((run) => run._id !== runId) }));
        }
    };
});
