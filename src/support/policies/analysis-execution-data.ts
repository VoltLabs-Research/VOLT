import zlib from 'node:zlib';
import type { AnalysisJobExecutionData } from '@/contracts';

export const serializeAnalysisExecutionData = (executionData: AnalysisJobExecutionData): string => {
    return JSON.stringify(executionData);
};

export const compressSerializedAnalysisExecutionData = (serializedValue: string): string => {
    return zlib.gzipSync(serializedValue).toString('base64');
};

export const inflateAnalysisExecutionData = (compressedValue: string): AnalysisJobExecutionData => {
    const buffer = Buffer.from(compressedValue, 'base64');
    return JSON.parse(zlib.gunzipSync(buffer).toString('utf8')) as AnalysisJobExecutionData;
};

export const parseStoredAnalysisExecutionData = (storedValue: string): AnalysisJobExecutionData => {
    try {
        return inflateAnalysisExecutionData(storedValue);
    } catch {
        return JSON.parse(storedValue) as AnalysisJobExecutionData;
    }
};
