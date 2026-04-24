import fs from 'node:fs/promises';
import { dir as createTempDir } from 'tmp-promise';

import { Service } from '@/core/decorators/service';
import { DAEMON_PATHS } from '@/core/paths';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { downloadCompressedDump } from '@/modules/analysis/application/workflow/dump-download';
import type { WorkflowDumpTarget } from '@/modules/analysis/application/workflow/WorkflowRuntime';
import type {
    AnalysisJobExecutionData,
    AnalysisJobMetadata
} from '@/modules/analysis/contracts/http-analysis';
import type { WorkflowNodeOutput } from '@/modules/analysis/contracts/workflow.types';
import { mapLimited } from '@/support/concurrency/map-limited';
import { safeRemovePath } from '@/support/fs/safe-remove-path';

const BATCH_DUMP_DOWNLOAD_CONCURRENCY = 8;


export interface AnalysisEnvironmentState {
    outputDir: string;
    outputs: Map<string, WorkflowNodeOutput>;
    dumpTargets: WorkflowDumpTarget[];
    dumpLocalPaths: string[];
}

@Service('analysisEnvironment')
export class AnalysisEnvironment {
    constructor(private readonly objectStore: ClusterObjectStore) {}

    async prepare(
        executionData: AnalysisJobExecutionData,
        metadata: AnalysisJobMetadata,
        timestep: number | undefined
    ): Promise<AnalysisEnvironmentState> {
        const runtime = await this.initialize(executionData, metadata);

        if (executionData.batch) {
            await this.downloadBatchDumps(runtime, executionData);
            runtime.dumpTargets = this.buildBatchDumpTargets(executionData, runtime.dumpLocalPaths);
            runtime.outputs = this.buildBatchOutputs(executionData, runtime.dumpTargets, runtime.outputDir);
            return runtime;
        }

        await this.downloadSingleDump(runtime, executionData, metadata);
        runtime.dumpTargets = this.buildSingleDumpTargets(executionData, runtime.dumpLocalPaths, timestep);
        runtime.outputs = this.buildSingleOutputs(executionData, metadata, runtime);
        return runtime;
    }

    async cleanup(runtime: AnalysisEnvironmentState): Promise<void> {
        const tasks: Promise<unknown>[] = runtime.dumpLocalPaths.map((dumpPath) => safeRemovePath(dumpPath));
        if (runtime.outputDir) {
            tasks.push(safeRemovePath(runtime.outputDir, { recursive: true }));
        }
        await Promise.all(tasks);
    }

    private async initialize(
        executionData: AnalysisJobExecutionData,
        metadata: AnalysisJobMetadata
    ): Promise<AnalysisEnvironmentState> {
        await fs.mkdir(DAEMON_PATHS.analysisOutput, { recursive: true });
        const prefixSuffix = metadata.forEachIndex === undefined ? '' : `${metadata.forEachIndex}-`;
        const outputDir = (await createTempDir({
            tmpdir: DAEMON_PATHS.analysisOutput,
            prefix: `${executionData.identity.analysisId}-${prefixSuffix}`,
            unsafeCleanup: true
        })).path;

        return { outputDir, outputs: new Map(), dumpTargets: [], dumpLocalPaths: [] };
    }

    private async downloadBatchDumps(runtime: AnalysisEnvironmentState, executionData: AnalysisJobExecutionData): Promise<void> {
        const { storageClusterId } = executionData.identity;
        const dumps = executionData.batch!.trajectoryDumps;

        const localPaths = await mapLimited(
            dumps,
            BATCH_DUMP_DOWNLOAD_CONCURRENCY,
            (dump) => downloadCompressedDump(this.objectStore, dump.path, storageClusterId!, DAEMON_PATHS.analysisDumps)
        );

        runtime.dumpLocalPaths.push(...localPaths);
    }

    private async downloadSingleDump(
        runtime: AnalysisEnvironmentState,
        executionData: AnalysisJobExecutionData,
        metadata: AnalysisJobMetadata
    ): Promise<void> {
        const { storageClusterId } = executionData.identity;
        runtime.dumpLocalPaths.push(await downloadCompressedDump(this.objectStore, metadata.inputFile!, storageClusterId!, DAEMON_PATHS.analysisDumps));
    }

    private buildBatchDumpTargets(
        executionData: AnalysisJobExecutionData,
        dumpLocalPaths: string[]
    ): WorkflowDumpTarget[] {
        return executionData.batch!.trajectoryDumps.map((dump, index) => ({
            localPath: dumpLocalPaths[index]!,
            originalPath: dump.originalPath ?? dump.path,
            timestep: dump.timestep,
            natoms: dump.natoms,
            simulationCell: dump.simulationCell
        }));
    }

    private buildSingleDumpTargets(
        executionData: AnalysisJobExecutionData,
        dumpLocalPaths: string[],
        timestep: number | undefined
    ): WorkflowDumpTarget[] {
        if (timestep === undefined) {
            throw new Error(`Single-dump analysis ${executionData.identity.analysisId} requires a timestep`);
        }

        const frame = executionData.trajectoryFrames.find((candidate) => candidate.timestep === timestep);
        if (!frame) {
            throw new Error(`Trajectory frame missing for analysis ${executionData.identity.analysisId} timestep ${timestep}`);
        }

        return [{
            localPath: dumpLocalPaths[0]!,
            originalPath: undefined,
            timestep,
            natoms: frame.natoms,
            simulationCell: frame.simulationCell
        }];
    }

    private buildSingleOutputs(
        executionData: AnalysisJobExecutionData,
        metadata: AnalysisJobMetadata,
        runtime: AnalysisEnvironmentState
    ): Map<string, WorkflowNodeOutput> {
        const outputs = this.snapshotToOutputs(executionData);
        const forEachNodeId = executionData.workflow.forEachNodeId;
        if (!forEachNodeId) {
            return outputs;
        }

        if (!metadata.forEachItem || metadata.forEachIndex === undefined) {
            throw new Error(`forEach node ${forEachNodeId} requires forEachItem and forEachIndex in metadata`);
        }

        const dumpLocalPath = runtime.dumpLocalPaths[0]!;

        outputs.set(forEachNodeId, {
            ...outputs.get(forEachNodeId),
            currentValue: { ...metadata.forEachItem, path: dumpLocalPath },
            currentIndex: metadata.forEachIndex,
            outputPath: runtime.outputDir
        });

        return outputs;
    }

    private buildBatchOutputs(
        executionData: AnalysisJobExecutionData,
        dumpTargets: WorkflowDumpTarget[],
        outputDir: string
    ): Map<string, WorkflowNodeOutput> {
        const outputs = this.snapshotToOutputs(executionData);
        const contextNodeId = executionData.batch?.contextNodeId;
        if (!contextNodeId) {
            return outputs;
        }

        const trajectoryDumps = dumpTargets.map((target): WorkflowNodeOutput => ({
            timestep: target.timestep,
            natoms: target.natoms,
            simulationCell: target.simulationCell,
            path: target.localPath,
            originalPath: target.originalPath
        }));
        const previous = outputs.get(contextNodeId);

        outputs.set(contextNodeId, {
            ...previous,
            trajectory_dumps: trajectoryDumps,
            trajectory: Object.assign({}, previous?.trajectory, { frames: trajectoryDumps }),
            allDumpLocalPaths: JSON.stringify(dumpTargets.map((target) => target.localPath)),
            outputPath: outputDir
        });

        return outputs;
    }

    private snapshotToOutputs(executionData: AnalysisJobExecutionData): Map<string, WorkflowNodeOutput> {
        return new Map(Object.entries(executionData.workflow.nodeOutputSnapshots)) as Map<string, WorkflowNodeOutput>;
    }
}
