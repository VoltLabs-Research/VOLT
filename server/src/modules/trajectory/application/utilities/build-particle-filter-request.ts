import { ParticleFilterCombinator } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';

import type {
    ParticleFilterCondition,
    ParticleFilterRequest
} from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import type { ParticleFilterConditionDTO } from '@modules/trajectory/application/dtos/particle-filter';

interface ParticleFilterRequestInputLike {
    exposureId?: string;
    property?: string;
    operator?: string;
    value?: string | number;
    combinator?: ParticleFilterCombinator;
    conditions?: ParticleFilterConditionDTO[];
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
    property?: string;
    operator?: string;
    value?: string | number;
    exposureId?: string;
}): ParticleFilterCondition => {
    return {
        property: input.property || '',
        operator: resolveFilterOperator(input.operator),
        value: Number(input.value ?? 0),
        ...(input.exposureId ? { exposureId: input.exposureId } : {})
    };
};

const resolveCondition = (condition: ParticleFilterConditionDTO): ParticleFilterCondition => {
    return buildPropertyCondition(condition);
};

export const buildParticleFilterRequest = (
    input: ParticleFilterRequestInputLike
): ParticleFilterRequest => {
    if (input.conditions && input.conditions.length > 0) {
        return {
            combinator: input.combinator || ParticleFilterCombinator.And,
            conditions: input.conditions.map(resolveCondition)
        };
    }

    return {
        combinator: input.combinator || ParticleFilterCombinator.And,
        conditions: [buildPropertyCondition(input)]
    };
};
