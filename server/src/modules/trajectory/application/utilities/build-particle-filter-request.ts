import { ParticleFilterCombinator } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';

import type {
    ParticleFilterCondition,
    ParticleFilterRequest
} from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import type { ParticleFilterConditionDTO } from '@modules/trajectory/application/dtos/particle-filter';

interface ParticleFilterRequestInputLike {
    combinator: ParticleFilterCombinator;
    conditions: ParticleFilterConditionDTO[];
}

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
    value: typeof input.value === 'number' ? input.value : input.value,
    ...(input.exposureId ? { exposureId: input.exposureId } : {})
});

const resolveCondition = (condition: ParticleFilterConditionDTO): ParticleFilterCondition => (
    buildPropertyCondition(condition)
);

export const buildParticleFilterRequest = (
    input: ParticleFilterRequestInputLike
): ParticleFilterRequest => {
    if (input.conditions.length === 0) {
        throw new Error('Particle filter requires at least one condition');
    }

    return {
        combinator: input.combinator,
        conditions: input.conditions.map(resolveCondition)
    };
};
