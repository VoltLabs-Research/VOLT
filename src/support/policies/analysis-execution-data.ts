import type { AnalysisJobExecutionData } from '@/contracts';
import {
    deflateJsonToBase64Gzip,
    inflateBase64GzipJson
} from '@/support/serialization/gzip-base64-json';

export const serializeAnalysisExecutionData = (executionData: AnalysisJobExecutionData): string =>
    JSON.stringify(executionData);

export const compressSerializedAnalysisExecutionData = (serializedValue: string): Promise<string> =>
    deflateJsonToBase64Gzip(serializedValue);

export const inflateAnalysisExecutionData = (compressedValue: string): Promise<AnalysisJobExecutionData> =>
    inflateBase64GzipJson<AnalysisJobExecutionData>(compressedValue);

export const parseStoredAnalysisExecutionData = async (storedValue: string): Promise<AnalysisJobExecutionData> => {
    try {
        return await inflateAnalysisExecutionData(storedValue);
    } catch {
        return JSON.parse(storedValue) as AnalysisJobExecutionData;
    }
};
