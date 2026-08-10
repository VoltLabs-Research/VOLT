import { singleton } from '@shared/application/utilities/singleton';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import fs from 'node:fs/promises';
import { dir as createTempDir } from 'tmp-promise';

import { DAEMON_PATHS } from '@core/config/paths';
import type { ClusterObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import {
    downloadAnalysisDump,
    dumpObjectKey,
    materializeFrameArgumentDumps
} from '@modules/analysis/services/workflow/analysis-dump-localization';
import type { TrajectoryDumpDescriptor } from '@shared/contracts';
import type { AnalysisJobExecutionData, AnalysisJobMetadata } from '@shared/contracts/types/http-analysis';
import type { WorkflowDumpTarget, WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';
import { safeRemovePath } from '@shared/infrastructure/utilities/safe-remove-path';

export interface AnalysisEnvironmentState {
    outputDir: string;
    outputs: Map<string, WorkflowNodeOutput>;
    dumpTargets: WorkflowDumpTarget[];
    dumpLocalPaths: string[];
    primaryFrameIndex: number;
}

/** The only metadata the initial node outputs need: which forEach item this job is. */
export type AnalysisSeedMetadata = Pick<AnalysisJobMetadata, 'forEachItem' | 'forEachIndex'>;

const createState = (outputDir: string): AnalysisEnvironmentState => ({
    outputDir,
    outputs: new Map(),
    dumpTargets: [],
    dumpLocalPaths: [],
    primaryFrameIndex: 0
});

export class AnalysisEnvironment {
    constructor(private readonly objectStore: ClusterObjectStore) {}

    async prepare(
        executionData: AnalysisJobExecutionData,
        metadata: AnalysisJobMetadata,
        timestep: number | undefined
    ): Promise<AnalysisEnvironmentState> {
        if (timestep === undefined) {
            throw new Error(`Analysis ${executionData.identity.analysisId} requires a primary timestep`);
        }

        const runtime = await this.initialize(executionData, metadata);

        const windowTimesteps = metadata.windowTimesteps?.length
            ? metadata.windowTimesteps
            : [timestep];

        const timestepToLocalPath = await this.downloadFrameSet(runtime, executionData, windowTimesteps);
        runtime.dumpTargets = windowTimesteps.map((windowTimestep) => this.buildDumpTarget(
            executionData,
            windowTimestep,
            timestepToLocalPath.get(windowTimestep)!
        ));
        runtime.primaryFrameIndex = Math.max(0, windowTimesteps.indexOf(timestep));
        return this.seedOutputs(runtime, executionData, metadata);
    }

    async prepareWithDump(
        executionData: AnalysisJobExecutionData,
        metadata: AnalysisSeedMetadata,
        timestep: number,
        workingDumpPath: string,
        stageOutputDir: string
    ): Promise<AnalysisEnvironmentState> {
        await fs.mkdir(stageOutputDir, { recursive: true });
        const runtime = createState(stageOutputDir);

        runtime.dumpTargets = [this.buildDumpTarget(executionData, timestep, workingDumpPath)];
        return this.seedOutputs(runtime, executionData, metadata);
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

        return createState((await createTempDir({
            tmpdir: DAEMON_PATHS.analysisOutput,
            prefix: `${executionData.identity.analysisId}-${prefixSuffix}`,
            unsafeCleanup: true
        })).path);
    }

    /** Pairs one already-localized dump with the trajectory frame it belongs to. */
    private buildDumpTarget(
        executionData: AnalysisJobExecutionData,
        timestep: number,
        localPath: string
    ): WorkflowDumpTarget {
        const frame = executionData.trajectoryFrames.find((candidate) => candidate.timestep === timestep);
        if (!frame) {
            throw new Error(`Trajectory frame missing for analysis ${executionData.identity.analysisId} timestep ${timestep}`);
        }

        return {
            localPath,
            originalPath: dumpObjectKey(executionData.identity.trajectoryId, timestep),
            timestep,
            natoms: frame.natoms,
            simulationCell: frame.simulationCell
        };
    }

    private async downloadFrameSet(
        runtime: AnalysisEnvironmentState,
        executionData: AnalysisJobExecutionData,
        windowTimesteps: number[]
    ): Promise<Map<number, string>> {
        const timestepToLocalPath = new Map<number, string>();
        for (const windowTimestep of windowTimesteps) {
            if (timestepToLocalPath.has(windowTimestep)) {
                continue;
            }

            timestepToLocalPath.set(windowTimestep, await downloadAnalysisDump(
                this.objectStore,
                runtime,
                executionData,
                windowTimestep,
                `Analysis ${executionData.identity.analysisId} cannot download dumps without a storage cluster`
            ));
        }

        return timestepToLocalPath;
    }

    /** Seeds the node outputs the workflow starts from, rebound to the frames this job localized. */
    private async seedOutputs(
        runtime: AnalysisEnvironmentState,
        executionData: AnalysisJobExecutionData,
        metadata: AnalysisSeedMetadata
    ): Promise<AnalysisEnvironmentState> {
        const { forEachNodeId, trajectoryWindowNodeId, nodeOutputSnapshots } = executionData.workflow;
        const outputs = new Map(Object.entries(nodeOutputSnapshots)) as Map<string, WorkflowNodeOutput>;
        const frames: TrajectoryDumpDescriptor[] = runtime.dumpTargets.map((target) => ({
            timestep: target.timestep,
            natoms: target.natoms,
            simulationCell: target.simulationCell,
            path: target.localPath,
            originalPath: target.originalPath
        }));
        const primaryIndex = runtime.primaryFrameIndex;

        if (forEachNodeId) {
            if (!metadata.forEachItem || metadata.forEachIndex === undefined) {
                throw new Error(`forEach node ${forEachNodeId} requires forEachItem and forEachIndex in metadata`);
            }

            outputs.set(forEachNodeId, {
                ...outputs.get(forEachNodeId),
                currentValue: {
                    ...metadata.forEachItem,
                    path: frames[primaryIndex]?.path
                },
                currentIndex: metadata.forEachIndex,
                outputPath: runtime.outputDir
            });
        }

        if (trajectoryWindowNodeId) {
            const framePaths = frames.map((frame) => frame.path);

            outputs.set(trajectoryWindowNodeId, {
                ...outputs.get(trajectoryWindowNodeId),
                frames,
                count: frames.length,
                primaryIndex,
                primaryValue: frames[primaryIndex] ?? null,
                framePaths: framePaths.join(' '),
                framePathsCsv: framePaths.join(','),
                outputPath: runtime.outputDir
            });
        }

        runtime.outputs = outputs;
        await materializeFrameArgumentDumps(this.objectStore, runtime, executionData);
        return runtime;
    }
}

export const getAnalysisEnvironment = singleton((): AnalysisEnvironment => new AnalysisEnvironment(getObjectStore()));
