import { ContainerAction, ObjectBucketName, TextEncoding } from '@/shared/contracts';
import { isRecord } from '@/shared/utils';

export const readString = (value: unknown, fieldName: string): string => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${fieldName} is required`);
    }

    return value;
};

export const readOptionalString = (value: unknown, fallback = ''): string => {
    if (typeof value !== 'string') {
        return fallback;
    }

    return value;
};

export const readBoolean = (value: unknown, fieldName: string): boolean => {
    if (typeof value !== 'boolean') {
        throw new Error(`${fieldName} must be a boolean`);
    }

    return value;
};

export const readOptionalBoolean = (value: unknown, fallback: boolean): boolean => {
    if (typeof value !== 'boolean') {
        return fallback;
    }

    return value;
};

export const readNumber = (value: unknown, fieldName: string): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${fieldName} must be a number`);
    }

    return value;
};

export const readOptionalNumber = (value: unknown): number | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }

    return value;
};

export const readRecord = (value: unknown, fieldName: string): Record<string, unknown> => {
    if (!isRecord(value)) {
        throw new Error(`${fieldName} must be an object`);
    }

    const record: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
        record[key] = entryValue;
    }

    return record;
};

export const readOptionalRecord = (value: unknown): Record<string, unknown> | undefined => {
    if (!isRecord(value)) {
        return undefined;
    }

    const record: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
        record[key] = entryValue;
    }

    return record;
};

export const readPayloadRecord = (value: unknown): Record<string, unknown> => {
    return readRecord(value, 'payload');
};

export const readOptionalPayloadRecord = (value: unknown): Record<string, unknown> => {
    const record = readOptionalRecord(value);

    if (!record) {
        return {};
    }

    return record;
};

export const readStringArray = (value: unknown, fieldName: string): string[] => {
    if (!Array.isArray(value)) {
        throw new Error(`${fieldName} must be an array`);
    }

    const values: string[] = [];
    for (const entry of value) {
        values.push(readString(entry, fieldName));
    }

    return values;
};

export const readOptionalStringArray = (value: unknown, fieldName: string): string[] | undefined => {
    if (typeof value === 'undefined') {
        return undefined;
    }

    return readStringArray(value, fieldName);
};

export const readOptionalNumberArray = (value: unknown, fieldName: string): number[] | undefined => {
    if (typeof value === 'undefined') {
        return undefined;
    }

    if (!Array.isArray(value)) {
        throw new Error(`${fieldName} must be an array`);
    }

    return value.map((entry) => readNumber(entry, fieldName));
};

export const readOptionalStringRecord = (value: unknown, fieldName: string): Record<string, string> | undefined => {
    if (typeof value === 'undefined') {
        return undefined;
    }

    const record = readRecord(value, fieldName);
    const result: Record<string, string> = {};

    for (const [key, entryValue] of Object.entries(record)) {
        result[key] = readString(entryValue, `${fieldName}.${key}`);
    }

    return result;
};

export const readOptionalUnknownRecord = (value: unknown, fieldName: string): Record<string, unknown> | undefined => {
    if (typeof value === 'undefined') {
        return undefined;
    }

    return readRecord(value, fieldName);
};

export const readPluginPropertyNamesRequest = (payload: unknown) => {
    const record = readOptionalPayloadRecord(payload);
    return {
        trajectoryId: readString(record.trajectoryId, 'trajectoryId'),
        analysisId: readString(record.analysisId, 'analysisId'),
        exposureId: readString(record.exposureId, 'exposureId')
    };
};

export const readPluginModifierAnalysisRequest = (payload: unknown) => {
    const request = readPluginPropertyNamesRequest(payload);
    const record = readOptionalPayloadRecord(payload);
    return {
        ...request,
        timestep: readNumber(record.timestep, 'timestep')
    };
};

export const readPluginAtomIndexRequest = (payload: unknown) => {
    const request = readPluginModifierAnalysisRequest(payload);
    const record = readOptionalPayloadRecord(payload);
    return {
        ...request,
        targetIds: readOptionalNumberArray(record.targetIds, 'targetIds') || []
    };
};

export const readPluginModifierValuesRequest = (payload: unknown) => {
    const request = readPluginModifierAnalysisRequest(payload);
    const record = readOptionalPayloadRecord(payload);
    return {
        ...request,
        property: readString(record.property, 'property')
    };
};

export const readPluginModifierStatsRequest = (payload: unknown) => {
    return readPluginModifierValuesRequest(payload);
};

export const readPluginModifierUniqueValuesRequest = (payload: unknown) => {
    const request = readPluginModifierValuesRequest(payload);
    const record = readOptionalPayloadRecord(payload);
    return {
        ...request,
        maxValues: readOptionalNumber(record.maxValues)
    };
};

export const readObjectBucketName = (value: unknown, fieldName: string): ObjectBucketName => {
    const bucketName = readString(value, fieldName);

    if (!Object.values(ObjectBucketName).includes(bucketName as ObjectBucketName)) {
        throw new Error(`${fieldName} is invalid`);
    }

    return bucketName as ObjectBucketName;
};

export const readTextEncoding = (value: unknown): TextEncoding | undefined => {
    if (typeof value === 'undefined') {
        return undefined;
    }

    const encoding = readString(value, 'encoding');
    if (!Object.values(TextEncoding).includes(encoding as TextEncoding)) {
        throw new Error('encoding is invalid');
    }

    return encoding as TextEncoding;
};

export const readContainerAction = (value: unknown): ContainerAction => {
    const action = readString(value, 'action');
    if (!Object.values(ContainerAction).includes(action as ContainerAction)) {
        throw new Error('action is invalid');
    }

    return action as ContainerAction;
};
