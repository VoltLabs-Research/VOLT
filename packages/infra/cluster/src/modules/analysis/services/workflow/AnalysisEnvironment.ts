import { singleton } from '@shared/utilities/singleton';
import { getObjectStore } from '@shared/storage/ClusterObjectStore';
import fs from 'node:fs/promises';
import { dir as createTempDir } from 'tmp-promise';

import { DAEMON_PATHS } from '@core/config/paths';
import type { ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import {
    downloadAnalysisDump,
    dumpObjectKey,
    materializeFrameArgumentDumps
} from '@modules/analysis/services/workflow/analysis-dump-localization';
import type { AnalysisJobExecutionData, AnalysisJobMetadata } from '@shared/contracts/types/http-analysis';
import type { WorkflowDumpTarget, WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';
import { safeRemovePath } from '@shared/utilities/safe-remove-path';

export interface AnalysisEnvironmentState {
    outputDir: string;
    outputs: Map<string, WorkflowNodeOutput>;
    dumpTarget: WorkflowDumpTarget | null;
    dumpLocalPaths: string[];
}

export type AnalysisSeedMetadata = Pick<AnalysisJobMetadata, 'forEachItem' | 'forEachIndex'>;

const createState = (outputDir: string): AnalysisEnvironmentState => ({
    outputDir,
    outputs: new Map(),
    dumpTarget: null,
    dumpLocalPaths: []
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
        const localPath = await downloadAnalysisDump(
            this.objectStore,
            runtime,
            executionData,
            timestep,
            `Analysis ${executionData.identity.analysisId} cannot download dumps without a storage cluster`
        );
        runtime.dumpTarget = this.buildDumpTarget(executionData, timestep, localPath);
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

        runtime.dumpTarget = this.buildDumpTarget(executionData, timestep, workingDumpPath);
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

    private async seedOutputs(
        runtime: AnalysisEnvironmentState,
        executionData: AnalysisJobExecutionData,
        metadata: AnalysisSeedMetadata
    ): Promise<AnalysisEnvironmentState> {
        const { forEachNodeId, nodeOutputSnapshots } = executionData.workflow;
        const outputs = new Map(Object.entries(nodeOutputSnapshots)) as Map<string, WorkflowNodeOutput>;

        if (forEachNodeId) {
            if (!metadata.forEachItem || metadata.forEachIndex === undefined) {
                throw new Error(`forEach node ${forEachNodeId} requires forEachItem and forEachIndex in metadata`);
            }

            outputs.set(forEachNodeId, {
                ...outputs.get(forEachNodeId),
                currentValue: {
                    ...metadata.forEachItem,
                    path: runtime.dumpTarget?.localPath
                },
                currentIndex: metadata.forEachIndex,
                outputPath: runtime.outputDir
            });
        }

        runtime.outputs = outputs;
        await materializeFrameArgumentDumps(this.objectStore, runtime, executionData);
        return runtime;
    }
}

export const getAnalysisEnvironment = singleton((): AnalysisEnvironment => new AnalysisEnvironment(getObjectStore()));
