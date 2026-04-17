import { z } from 'zod';
import type { AnalysisJobExecutionData } from '@/contracts';
import zlib from 'node:zlib';

const nonEmptyString = z.string().min(1);
const finiteNumber = z.number().finite();

const workflowDefinitionSchema = z.object({
    nodes: z.array(z.unknown()),
    edges: z.array(z.unknown())
});

const trajectoryDumpDescriptorSchema = z.object({
    path: nonEmptyString,
    timestep: finiteNumber,
    natoms: finiteNumber,
    simulationCell: z.string(),
    originalPath: z.string().optional()
});

const analysisJobExecutionDataSchema = z.object({
    binaryObjectPath: z.string(),
    entrypointType: z.unknown().optional(),
    arguments: z.string(),
    timeoutMs: finiteNumber.optional(),
    requirementsFile: z.string().optional(),
    entrypointScript: z.string().optional(),
    pluginId: z.string(),
    trajectoryId: z.string(),
    analysisId: z.string(),
    teamId: z.string().optional(),
    trajectoryFrames: z.array(z.unknown()),
    computeClusterId: z.string().optional(),
    storageClusterId: z.string().optional(),
    pluginBinaryRef: z.unknown().optional(),
    exposures: z.array(z.unknown()),
    forEachNodeId: z.string().optional(),
    nodeOutputSnapshots: z.record(z.string(), z.unknown()),
    workflow: workflowDefinitionSchema,
    nestedPlugins: z.array(z.unknown()),
    pluginReferenceExecutions: z.array(z.unknown()).optional(),
    batchTrajectoryDumps: z.array(trajectoryDumpDescriptorSchema).optional(),
    allDumpUrls: z.array(nonEmptyString).optional(),
    batchMode: z.boolean().optional(),
    contextNodeId: z.string().optional(),
    traceContext: z.record(z.string(), z.unknown()).optional()
});

export const serializeAnalysisExecutionData: (executionData: AnalysisJobExecutionData) => string = JSON.stringify;

const parseSerializedAnalysisExecutionData = (serializedValue: string): AnalysisJobExecutionData => {
    return analysisJobExecutionDataSchema.parse(JSON.parse(serializedValue)) as AnalysisJobExecutionData;
};

export const compressSerializedAnalysisExecutionData = (serializedValue: string): string => {
    return zlib.gzipSync(serializedValue).toString('base64');
};

export const inflateAnalysisExecutionData = (compressedValue: string): AnalysisJobExecutionData => {
    const compressedBuffer = Buffer.from(compressedValue, 'base64');
    const serializedValue = zlib.gunzipSync(compressedBuffer).toString('utf8');
    return parseSerializedAnalysisExecutionData(serializedValue);
};

export const parseStoredAnalysisExecutionData = (storedValue: string): AnalysisJobExecutionData => {
    try {
        return inflateAnalysisExecutionData(storedValue);
    } catch {
        return parseSerializedAnalysisExecutionData(storedValue);
    }
};
