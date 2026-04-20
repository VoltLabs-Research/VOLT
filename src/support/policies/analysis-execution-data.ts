import zlib from 'node:zlib';
import type { AnalysisJobExecutionData } from '@/contracts';
import { inflateBase64GzipJson } from '@/support/serialization/gzip-base64-json';

export const serializeAnalysisExecutionData = (executionData: AnalysisJobExecutionData): string =>
    JSON.stringify(executionData);

export const compressSerializedAnalysisExecutionData = (serializedValue: string): string =>
    zlib.gzipSync(serializedValue).toString('base64');

export const inflateAnalysisExecutionData = (compressedValue: string): AnalysisJobExecutionData =>
    inflateBase64GzipJson<AnalysisJobExecutionData>(compressedValue);

export const parseStoredAnalysisExecutionData = (storedValue: string): AnalysisJobExecutionData => {
    try {
        return inflateAnalysisExecutionData(storedValue);
    } catch {
        return JSON.parse(storedValue) as AnalysisJobExecutionData;
    }
};
