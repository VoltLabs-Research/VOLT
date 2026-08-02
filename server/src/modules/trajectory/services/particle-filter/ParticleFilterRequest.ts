import { ErrorCodes } from '@core/constants/error-codes';
import type { FilterExpression } from '@modules/trajectory/services/trajectory/AtomPropertiesService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { ParticleFilterCombinator } from '@volt/contracts/modules/trajectory/http';

export interface ParticleFilterConditionInput {
    property: string;
    operator: string;
    value: number | string;
    exposureId?: string;
}

export interface ParticleFilterCondition extends FilterExpression {
    exposureId?: string;
}

export interface ParticleFilterRequest {
    combinator: ParticleFilterCombinator;
    conditions: ParticleFilterCondition[];
}

export interface ParticleFilterRequestInputLike {
    combinator: ParticleFilterCombinator;
    conditions?: ParticleFilterConditionInput[] | string;
}

/**
 * `conditions` arrives from a query string or a JSON body, so it may be absent
 * or a JSON-encoded array. Parsing it is the point of this function; an empty
 * result is rejected with a 400 by the caller.
 */
const normalizeConditions = (
    conditions: ParticleFilterConditionInput[] | string | undefined
): ParticleFilterConditionInput[] => {
    if (typeof conditions !== 'string') {
        return Array.isArray(conditions) ? conditions : [];
    }

    try {
        const parsed = JSON.parse(conditions) as unknown;
        return Array.isArray(parsed) ? parsed as ParticleFilterConditionInput[] : [];
    } catch {
        return [];
    }
};

/**
 * The wire contract declares `operator` as a plain `string`, while the native
 * filter expression only accepts the six comparison literals, so this narrowing
 * is load-bearing rather than defensive.
 */
const resolveFilterOperator = (operator: string): FilterExpression['operator'] => {
    switch (operator) {
        case '!=':
        case '>':
        case '>=':
        case '<':
        case '<=':
            return operator;
        case '==':
        default:
            return '==';
    }
};

const buildPropertyCondition = (input: ParticleFilterConditionInput): ParticleFilterCondition => ({
    property: input.property,
    operator: resolveFilterOperator(input.operator),
    value: input.value,
    ...(input.exposureId ? { exposureId: input.exposureId } : {})
});

export const buildParticleFilterRequest = (
    input: ParticleFilterRequestInputLike
): ParticleFilterRequest => {
    const conditions = normalizeConditions(input.conditions);

    if (conditions.length === 0) {
        throw ApplicationError.badRequest(
            ErrorCodes.TRAJECTORY_PARTICLE_FILTER_CONDITIONS_REQUIRED,
            'A particle filter requires at least one condition.'
        );
    }

    return {
        combinator: input.combinator,
        conditions: conditions.map(buildPropertyCondition)
    };
};
