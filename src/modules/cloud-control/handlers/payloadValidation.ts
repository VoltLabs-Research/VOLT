import { isRecord } from '@/shared/utilities/type-guards';

const readString = (value: unknown, fieldName: string): string => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${fieldName} is required`);
    }

    return value;
};

const readNumber = (value: unknown, fieldName: string): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${fieldName} must be a number`);
    }

    return value;
};

const readOptionalNumber = (value: unknown): number | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }

    return value;
};

const readOptionalPayloadRecord = (value: unknown): Record<string, unknown> => {
    return isRecord(value) ? value : {};
};

const readOptionalNumberArray = (value: unknown, fieldName: string): number[] | undefined => {
    if (typeof value === 'undefined') {
        return undefined;
    }

    if (!Array.isArray(value)) {
        throw new Error(`${fieldName} must be an array`);
    }

    return value.map((entry) => readNumber(entry, fieldName));
};

export const readPluginPropertyNamesRequest = (payload: unknown) => {
    const record = readOptionalPayloadRecord(payload);
    const timestep = readOptionalNumber(record.timestep);
    const ownerClusterId = readString(record.ownerClusterId, 'ownerClusterId');

    return {
        trajectoryId: readString(record.trajectoryId, 'trajectoryId'),
        analysisId: readString(record.analysisId, 'analysisId'),
        exposureId: readString(record.exposureId, 'exposureId'),
        ...(typeof timestep === 'number' ? { timestep } : {}),
        ownerClusterId
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

export const readPluginModifierUniqueValuesRequest = (payload: unknown) => {
    const request = readPluginModifierValuesRequest(payload);
    const record = readOptionalPayloadRecord(payload);
    return {
        ...request,
        maxValues: readOptionalNumber(record.maxValues)
    };
};

export const readPluginAnalysisAllAtomsRequest = (payload: unknown) => {
    const record = readOptionalPayloadRecord(payload);
    const ownerClusterId = readString(record.ownerClusterId, 'ownerClusterId');
    return {
        trajectoryId: readString(record.trajectoryId, 'trajectoryId'),
        analysisId: readString(record.analysisId, 'analysisId'),
        timestep: readNumber(record.timestep, 'timestep'),
        ownerClusterId
    };
};
