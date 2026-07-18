import { isRecord } from '@shared/infrastructure/utilities/type-guards';

export const getPayloadValue = (payload: unknown, key: string): string => {
    if (!isRecord(payload) || typeof payload[key] !== 'string') {
        throw new Error(`Event payload is missing string field: ${key}`);
    }

    return payload[key];
};
