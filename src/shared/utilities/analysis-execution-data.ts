import { isRecord } from './type-guards';
import zlib from 'node:zlib';
import type { AnalysisExecutionDataReference, AnalysisJobExecutionData } from '@/shared/contracts';

const isWorkflowDefinition = (value: unknown): boolean => {
    return isRecord(value)
        && Array.isArray(value.nodes)
        && Array.isArray(value.edges);
};

const isTrajectoryDumpDescriptor = (value: unknown): boolean => {
    return isRecord(value)
        && typeof value.path === 'string'
        && typeof value.timestep === 'number'
        && Number.isFinite(value.timestep)
        && typeof value.natoms === 'number'
        && Number.isFinite(value.natoms)
        && typeof value.simulationCell === 'string'
        && (typeof value.originalPath === 'undefined' || typeof value.originalPath === 'string');
};

const hasValidBatchTrajectoryDumps = (value: unknown): boolean => {
    return typeof value === 'undefined'
        || (Array.isArray(value) && value.every(isTrajectoryDumpDescriptor));
};

const hasValidDumpUrls = (value: unknown): boolean => {
    return typeof value === 'undefined'
        || (Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.length > 0));
};

export const isAnalysisExecutionDataReference = (value: unknown): value is AnalysisExecutionDataReference => {
    return isRecord(value)
        && typeof value.key === 'string'
        && value.key.length > 0
        && typeof value.storedAt === 'string'
        && value.storedAt.length > 0
        && typeof value.ttlSeconds === 'number'
        && Number.isFinite(value.ttlSeconds);
};

export const isAnalysisJobExecutionData = (value: unknown): value is AnalysisJobExecutionData => {
    return isRecord(value)
        && typeof value.binaryObjectPath === 'string'
        && typeof value.arguments === 'string'
        && typeof value.pluginId === 'string'
        && typeof value.trajectoryId === 'string'
        && typeof value.analysisId === 'string'
        && (typeof value.teamId === 'undefined' || typeof value.teamId === 'string')
        && Array.isArray(value.trajectoryFrames)
        && Array.isArray(value.exposures)
        && isRecord(value.nodeOutputSnapshots)
        && isWorkflowDefinition(value.workflow)
        && Array.isArray(value.nestedPlugins)
        && hasValidBatchTrajectoryDumps(value.batchTrajectoryDumps)
        && hasValidDumpUrls(value.allDumpUrls);
};

export const serializeAnalysisExecutionData = (executionData: AnalysisJobExecutionData): string => {
    return JSON.stringify(executionData);
};

const parseSerializedAnalysisExecutionData = (serializedValue: string): AnalysisJobExecutionData => {
    const parsedExecutionData: unknown = JSON.parse(serializedValue);

    if (!isAnalysisJobExecutionData(parsedExecutionData)) {
        throw new Error('Analysis execution data must contain a valid analysis execution payload');
    }

    return parsedExecutionData;
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
