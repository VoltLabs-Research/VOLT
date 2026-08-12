import { toTrajectoryFrameDumpObjectKey } from '@shared/infrastructure/storage/storage-codec';
import { DAEMON_PATHS } from '@core/config/paths';
import { downloadCompressedDump } from '@modules/analysis/services/workflow/dump-download';
import { decodeCliArgumentsToken, encodeCliArgumentsToken } from '@shared/application/utilities/serialization';
import type { ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import type { AnalysisJobExecutionData } from '@shared/contracts/types/http-analysis';
import type { WorkflowArgumentDefinition } from '@shared/contracts/types/http-workflow';
import type { WorkflowDumpTarget, WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';

interface DumpLocalizationState {
    outputs: Map<string, WorkflowNodeOutput>;
    dumpTargets: WorkflowDumpTarget[];
    dumpLocalPaths: string[];
}

export const dumpObjectKey = (trajectoryId: string, timestep: number): string =>
    toTrajectoryFrameDumpObjectKey(trajectoryId, timestep);

export const downloadAnalysisDump = async (
    objectStore: ClusterObjectStore,
    state: DumpLocalizationState,
    executionData: AnalysisJobExecutionData,
    timestep: number,
    missingClusterMessage: string
): Promise<string> => {
    const { storageClusterId, trajectoryId } = executionData.identity;
    if (!storageClusterId) {
        throw new Error(missingClusterMessage);
    }

    const localPath = await downloadCompressedDump(
        objectStore,
        dumpObjectKey(trajectoryId, timestep),
        storageClusterId,
        DAEMON_PATHS.analysisDumps
    );
    state.dumpLocalPaths.push(localPath);
    return localPath;
};

const parseFrameArgumentTimestep = (value: WorkflowNodeOutput[string]): number | null => {
    if (typeof value === 'number') {
        return value;
    }

    if (typeof value !== 'string' || !value.trim()) {
        return null;
    }

    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
};

const rewriteCliFrameArguments = (
    output: WorkflowNodeOutput,
    replacements: Map<string, string>
): void => {
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
};

export const materializeFrameArgumentDumps = async (
    objectStore: ClusterObjectStore,
    state: DumpLocalizationState,
    executionData: AnalysisJobExecutionData
): Promise<void> => {
    const dumpPathByTimestep = new Map<number, string>(
        state.dumpTargets.map((target) => [target.timestep, target.localPath])
    );

    const resolveDumpPath = async (timestep: number): Promise<string> => {
        const existingPath = dumpPathByTimestep.get(timestep);
        if (existingPath) {
            return existingPath;
        }

        if (!executionData.trajectoryFrames.some((candidate) => candidate.timestep === timestep)) {
            throw new Error(`Reference frame ${timestep} is not available for trajectory ${executionData.identity.trajectoryId}`);
        }

        const localPath = await downloadAnalysisDump(
            objectStore,
            state,
            executionData,
            timestep,
            `Reference frame ${timestep} cannot be downloaded without a storage cluster`
        );
        dumpPathByTimestep.set(timestep, localPath);
        return localPath;
    };

    const materialize = async (
        definition: WorkflowArgumentDefinition,
        values: WorkflowNodeOutput,
        replacements: Map<string, string>
    ): Promise<void> => {
        const argumentKey = definition.argument;
        if (!argumentKey) {
            return;
        }

        if (definition.type === 'frame') {
            const timestep = parseFrameArgumentTimestep(values[argumentKey]);
            if (timestep === null) {
                return;
            }

            const localPath = await resolveDumpPath(timestep);
            values[argumentKey] = localPath;
            replacements.set(argumentKey, localPath);
            return;
        }

        const items = values[argumentKey];
        if (definition.type !== 'list' || !definition.listArguments?.length || !Array.isArray(items)) {
            return;
        }

        for (const item of items) {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                continue;
            }

            for (const nestedDefinition of definition.listArguments) {
                await materialize(nestedDefinition, item as WorkflowNodeOutput, replacements);
            }
        }
    };

    for (const node of executionData.workflow.definition.nodes) {
        const output = node.type === 'arguments' ? state.outputs.get(node.id) : undefined;
        if (!output) {
            continue;
        }

        const replacements = new Map<string, string>();
        for (const definition of node.data.arguments?.arguments ?? []) {
            await materialize(definition, output, replacements);
        }

        rewriteCliFrameArguments(output, replacements);
    }
};
