import { singleton } from '@shared/application/utilities/singleton';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import fs from 'node:fs/promises';
import { dir as createTempDir } from 'tmp-promise';

import { DAEMON_PATHS } from '@core/config/paths';
import type { ClusterObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { downloadCompressedDump } from '@modules/analysis/services/workflow/dump-download';
import type { WorkflowDumpTarget } from '@modules/analysis/services/workflow/WorkflowRuntime';
import type {
    AnalysisJobExecutionData,
    AnalysisJobMetadata
} from '@shared/contracts/types/http-analysis';
import type { WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';
import type { WorkflowArgumentDefinition } from '@shared/contracts/types/http-workflow';
import { safeRemovePath } from '@shared/infrastructure/utilities/safe-remove-path';
import { decodeCliArgumentsToken, encodeCliArgumentsToken } from '@shared/application/utilities/serialization';

export interface AnalysisEnvironmentState {
    outputDir: string;
    outputs: Map<string, WorkflowNodeOutput>;
    dumpTargets: WorkflowDumpTarget[];
    dumpLocalPaths: string[];
    primaryFrameIndex: number;
}

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
        runtime.dumpTargets = this.buildFrameSetTargets(executionData, windowTimesteps, timestepToLocalPath);
        runtime.primaryFrameIndex = Math.max(0, windowTimesteps.indexOf(timestep));
        runtime.outputs = this.buildOutputs(executionData, metadata, runtime, windowTimesteps);
        await this.materializeFrameArgumentDumps(runtime, executionData);
        return runtime;
    }

    async prepareWithDump(
        executionData: AnalysisJobExecutionData,
        metadata: AnalysisJobMetadata,
        timestep: number,
        workingDumpPath: string,
        stageOutputDir: string
    ): Promise<AnalysisEnvironmentState> {
        await fs.mkdir(stageOutputDir, { recursive: true });
        const runtime: AnalysisEnvironmentState = {
            outputDir: stageOutputDir,
            outputs: new Map(),
            dumpTargets: [],
            dumpLocalPaths: [],
            primaryFrameIndex: 0
        };

        const frame = executionData.trajectoryFrames.find((candidate) => candidate.timestep === timestep);
        if (!frame) {
            throw new Error(`Trajectory frame missing for analysis ${executionData.identity.analysisId} timestep ${timestep}`);
        }

        runtime.dumpTargets = [{
            localPath: workingDumpPath,
            originalPath: `trajectory-${executionData.identity.trajectoryId}/timestep-${timestep}.dump.zst`,
            timestep,
            natoms: frame.natoms,
            simulationCell: frame.simulationCell
        }];
        runtime.primaryFrameIndex = 0;
        runtime.outputs = this.buildOutputs(executionData, metadata, runtime, [timestep]);
        await this.materializeFrameArgumentDumps(runtime, executionData);
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

        return {
            outputDir,
            outputs: new Map(),
            dumpTargets: [],
            dumpLocalPaths: [],
            primaryFrameIndex: 0
        };
    }

    private async downloadFrameSet(
        runtime: AnalysisEnvironmentState,
        executionData: AnalysisJobExecutionData,
        windowTimesteps: number[]
    ): Promise<Map<number, string>> {
        const { storageClusterId, trajectoryId } = executionData.identity;
        if (!storageClusterId) {
            throw new Error(`Analysis ${executionData.identity.analysisId} cannot download dumps without a storage cluster`);
        }

        const timestepToLocalPath = new Map<number, string>();
        for (const windowTimestep of windowTimesteps) {
            if (timestepToLocalPath.has(windowTimestep)) {
                continue;
            }

            const objectKey = `trajectory-${trajectoryId}/timestep-${windowTimestep}.dump.zst`;
            const localPath = await downloadCompressedDump(
                this.objectStore,
                objectKey,
                storageClusterId,
                DAEMON_PATHS.analysisDumps
            );
            timestepToLocalPath.set(windowTimestep, localPath);
            runtime.dumpLocalPaths.push(localPath);
        }

        return timestepToLocalPath;
    }

    private buildFrameSetTargets(
        executionData: AnalysisJobExecutionData,
        windowTimesteps: number[],
        timestepToLocalPath: Map<number, string>
    ): WorkflowDumpTarget[] {
        return windowTimesteps.map((windowTimestep) => {
            const frame = executionData.trajectoryFrames.find((candidate) => candidate.timestep === windowTimestep);
            if (!frame) {
                throw new Error(`Trajectory frame missing for analysis ${executionData.identity.analysisId} timestep ${windowTimestep}`);
            }

            return {
                localPath: timestepToLocalPath.get(windowTimestep)!,
                originalPath: `trajectory-${executionData.identity.trajectoryId}/timestep-${windowTimestep}.dump.zst`,
                timestep: windowTimestep,
                natoms: frame.natoms,
                simulationCell: frame.simulationCell
            };
        });
    }

    private buildOutputs(
        executionData: AnalysisJobExecutionData,
        metadata: AnalysisJobMetadata,
        runtime: AnalysisEnvironmentState,
        windowTimesteps: number[]
    ): Map<string, WorkflowNodeOutput> {
        const outputs = this.snapshotToOutputs(executionData);
        const localizedFrames = runtime.dumpTargets.map((target) => ({
            timestep: target.timestep,
            natoms: target.natoms,
            simulationCell: target.simulationCell,
            path: target.localPath,
            originalPath: target.originalPath
        }));
        const primaryIndex = runtime.primaryFrameIndex;

        this.seedForEachOutput(executionData, metadata, runtime, outputs, localizedFrames, primaryIndex);
        this.seedTrajectoryWindowOutput(executionData, runtime, outputs, localizedFrames, primaryIndex);

        return outputs;
    }

    private seedForEachOutput(
        executionData: AnalysisJobExecutionData,
        metadata: AnalysisJobMetadata,
        runtime: AnalysisEnvironmentState,
        outputs: Map<string, WorkflowNodeOutput>,
        localizedFrames: WorkflowNodeOutput[],
        primaryIndex: number
    ): void {
        const forEachNodeId = executionData.workflow.forEachNodeId;
        if (!forEachNodeId) {
            return;
        }

        if (!metadata.forEachItem || metadata.forEachIndex === undefined) {
            throw new Error(`forEach node ${forEachNodeId} requires forEachItem and forEachIndex in metadata`);
        }

        const primaryFrame = localizedFrames[primaryIndex];
        outputs.set(forEachNodeId, {
            ...outputs.get(forEachNodeId),
            currentValue: {
                ...metadata.forEachItem,
                path: (primaryFrame?.path as string | undefined)
            },
            currentIndex: metadata.forEachIndex,
            outputPath: runtime.outputDir
        });
    }

    private seedTrajectoryWindowOutput(
        executionData: AnalysisJobExecutionData,
        runtime: AnalysisEnvironmentState,
        outputs: Map<string, WorkflowNodeOutput>,
        localizedFrames: WorkflowNodeOutput[],
        primaryIndex: number
    ): void {
        const windowNodeId = executionData.workflow.trajectoryWindowNodeId;
        if (!windowNodeId) {
            return;
        }

        outputs.set(windowNodeId, {
            ...outputs.get(windowNodeId),
            frames: localizedFrames,
            count: localizedFrames.length,
            primaryIndex,
            primaryValue: localizedFrames[primaryIndex] ?? null,
            framePaths: localizedFrames.map((frame) => frame.path as string).join(' '),
            framePathsCsv: localizedFrames.map((frame) => frame.path as string).join(','),
            outputPath: runtime.outputDir
        });
    }

    private snapshotToOutputs(executionData: AnalysisJobExecutionData): Map<string, WorkflowNodeOutput> {
        return new Map(Object.entries(executionData.workflow.nodeOutputSnapshots)) as Map<string, WorkflowNodeOutput>;
    }

    private async materializeFrameArgumentDumps(
        runtime: AnalysisEnvironmentState,
        executionData: AnalysisJobExecutionData
    ): Promise<void> {
        const referenceDumpPaths = new Map<number, string>();
        for (const target of runtime.dumpTargets) {
            referenceDumpPaths.set(target.timestep, target.localPath);
        }

        for (const node of executionData.workflow.definition.nodes) {
            if (node.type !== 'arguments') {
                continue;
            }

            const definitions = node.data.arguments?.arguments ?? [];
            if (!this.hasFrameArgument(definitions)) {
                continue;
            }

            const output = runtime.outputs.get(node.id);
            if (!output) {
                continue;
            }

            const replacements = new Map<string, string>();
            for (const definition of definitions) {
                await this.materializeFrameArgumentDefinition(
                    definition,
                    output,
                    replacements,
                    referenceDumpPaths,
                    runtime,
                    executionData
                );
            }

            this.rewriteCliFrameArguments(output, replacements);
        }
    }

    private hasFrameArgument(definitions: WorkflowArgumentDefinition[]): boolean {
        return definitions.some((definition) => {
            if (definition.type === 'frame') {
                return true;
            }

            return definition.listArguments ? this.hasFrameArgument(definition.listArguments) : false;
        });
    }

    private async materializeFrameArgumentDefinition(
        definition: WorkflowArgumentDefinition,
        values: WorkflowNodeOutput,
        replacements: Map<string, string>,
        referenceDumpPaths: Map<number, string>,
        runtime: AnalysisEnvironmentState,
        executionData: AnalysisJobExecutionData
    ): Promise<void> {
        const argumentKey = definition.argument;
        if (!argumentKey) {
            return;
        }

        if (definition.type === 'frame') {
            const timestep = this.parseFrameArgumentTimestep(values[argumentKey]);
            if (timestep === null) {
                return;
            }

            const localPath = await this.resolveFrameArgumentDumpPath(
                timestep,
                referenceDumpPaths,
                runtime,
                executionData
            );
            values[argumentKey] = localPath;
            replacements.set(argumentKey, localPath);
            return;
        }

        if (definition.type !== 'list' || !definition.listArguments?.length) {
            return;
        }

        const items = values[argumentKey];
        if (!Array.isArray(items)) {
            return;
        }

        for (const item of items) {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                continue;
            }

            for (const nestedDefinition of definition.listArguments) {
                await this.materializeFrameArgumentDefinition(
                    nestedDefinition,
                    item as WorkflowNodeOutput,
                    replacements,
                    referenceDumpPaths,
                    runtime,
                    executionData
                );
            }
        }
    }

    private parseFrameArgumentTimestep(value: WorkflowNodeOutput[string]): number | null {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }

        if (typeof value !== 'string') {
            return null;
        }

        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }

        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
    }

    private async resolveFrameArgumentDumpPath(
        timestep: number,
        referenceDumpPaths: Map<number, string>,
        runtime: AnalysisEnvironmentState,
        executionData: AnalysisJobExecutionData
    ): Promise<string> {
        const existingPath = referenceDumpPaths.get(timestep);
        if (existingPath) {
            return existingPath;
        }

        const frame = executionData.trajectoryFrames.find((candidate) => candidate.timestep === timestep);
        if (!frame) {
            throw new Error(`Reference frame ${timestep} is not available for trajectory ${executionData.identity.trajectoryId}`);
        }

        const storageClusterId = executionData.identity.storageClusterId;
        if (!storageClusterId) {
            throw new Error(`Reference frame ${timestep} cannot be downloaded without a storage cluster`);
        }

        const objectKey = `trajectory-${executionData.identity.trajectoryId}/timestep-${timestep}.dump.zst`;
        const localPath = await downloadCompressedDump(
            this.objectStore,
            objectKey,
            storageClusterId,
            DAEMON_PATHS.analysisDumps
        );
        referenceDumpPaths.set(timestep, localPath);
        runtime.dumpLocalPaths.push(localPath);
        return localPath;
    }

    private rewriteCliFrameArguments(
        output: WorkflowNodeOutput,
        replacements: Map<string, string>
    ): void {
        if (replacements.size === 0) {
            return;
        }

        const rawArgs = Array.isArray(output.as_array)
            ? output.as_array
            : typeof output.as_str === 'string'
                ? decodeCliArgumentsToken(output.as_str) ?? []
                : [];
        const cliArgs = rawArgs.map((entry) => String(entry));

        for (let index = 0; index < cliArgs.length - 1; index += 1) {
            const token = cliArgs[index];
            if (!token.startsWith('--')) {
                continue;
            }

            const replacement = replacements.get(token.slice(2));
            if (!replacement) {
                continue;
            }

            cliArgs[index + 1] = replacement;
            index += 1;
        }

        output.as_array = cliArgs;
        output.as_str = encodeCliArgumentsToken(cliArgs);
    }
}

export const getAnalysisEnvironment = singleton((): AnalysisEnvironment => new AnalysisEnvironment(getObjectStore()));
