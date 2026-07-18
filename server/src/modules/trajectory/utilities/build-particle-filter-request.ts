import { ParticleFilterCombinator } from '@modules/trajectory/services/particle-filter/ParticleFilterService';

import type {
    ParticleFilterCondition,
    ParticleFilterRequest
} from '@modules/trajectory/services/particle-filter/ParticleFilterService';
import type { ParticleFilterConditionInput } from '@modules/trajectory/contracts/trajectory';

interface ParticleFilterRequestInputLike {
    combinator: ParticleFilterCombinator;
    conditions: ParticleFilterConditionInput[] | string;
}

const normalizeConditions = (
    conditions: ParticleFilterConditionInput[] | string
): ParticleFilterConditionInput[] => {
    if (typeof conditions !== 'string') {
        return Array.isArray(conditions) ? conditions : [];
    }

    try {
        const parsed = JSON.parse(conditions);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const resolveFilterOperator = (operator: string | undefined): '==' | '!=' | '>' | '>=' | '<' | '<=' => {
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

const buildPropertyCondition = (input: {
    property: string;
    operator: string;
    value: number | string;
    exposureId?: string;
}): ParticleFilterCondition => ({
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
        throw new Error('Particle filter requires at least one condition');
    }

    return {
        combinator: input.combinator,
        conditions: conditions.map(buildPropertyCondition)
    };
};
