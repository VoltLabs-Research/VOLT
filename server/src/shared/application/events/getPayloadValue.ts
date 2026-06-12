import { isRecord } from '@shared/infrastructure/utilities/type-guards';

/**
 * Extract a required string field from a domain event payload.
 *
 * Shared by the cascade-delete handler bases ({@link DeleteManyOnEntityDeletedHandler},
 * {@link CascadeDeleteEachOnEntityDeletedHandler}) which key their delete filter
 * off a single payload field (e.g. `teamId`). Throws if the field is missing or
 * not a string so a malformed event fails loudly rather than deleting nothing.
 */
export const getPayloadValue = (payload: unknown, key: string): string => {
    if (!isRecord(payload) || typeof payload[key] !== 'string') {
        throw new Error(`Event payload is missing string field: ${key}`);
    }

    return payload[key];
};
