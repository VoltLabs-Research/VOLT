import {
    ParticleFilterCombinator,
    ParticleFilterConditionKind,
    ParticleFilterMode,
    ParticleFilterPreset,
    SurfaceAtomsCutoffMode
} from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';

import type {
    ParticleFilterCondition,
    ParticleFilterRequest,
    SurfaceAtomsPresetConfig
} from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import type {
    ParticleFilterConditionDTO,
    SurfaceAtomsPresetConfigDTO
} from '@modules/trajectory/application/dtos/particle-filter';

interface ParticleFilterRequestInputLike {
    mode?: ParticleFilterMode;
    exposureId?: string;
    property?: string;
    operator?: string;
    value?: string | number;
    combinator?: ParticleFilterCombinator;
    conditions?: ParticleFilterConditionDTO[];
    preset?: ParticleFilterPreset;
    presetConfig?: SurfaceAtomsPresetConfigDTO;
}

const DEFAULT_SURFACE_LAYERS = 10;
const DEFAULT_SURFACE_COORDINATION_DEFICIT = 2;
const DEFAULT_SURFACE_ANISOTROPY_THRESHOLD = 0.35;

const toPositiveInteger = (value: unknown, fallback: number): number => {
    const parsedValue = Number(value);

    if (!Number.isInteger(parsedValue) || parsedValue < 1) {
        return fallback;
    }

    return parsedValue;
};

const toUnitInterval = (value: unknown, fallback: number): number => {
    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue > 1) {
        return fallback;
    }

    return parsedValue;
};

const toOptionalPositiveNumber = (value: unknown): number | undefined => {
    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        return undefined;
    }

    return parsedValue;
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

const resolveSurfaceAtomsPresetConfig = (
    presetConfig?: SurfaceAtomsPresetConfigDTO
): SurfaceAtomsPresetConfig => {
    const cutoffMode = presetConfig?.cutoffMode === SurfaceAtomsCutoffMode.Manual
        ? SurfaceAtomsCutoffMode.Manual
        : SurfaceAtomsCutoffMode.Auto;
    const cutoffRadius = toOptionalPositiveNumber(presetConfig?.cutoffRadius);

    return {
        layers: toPositiveInteger(presetConfig?.layers, DEFAULT_SURFACE_LAYERS),
        cutoffMode,
        ...(cutoffMode === SurfaceAtomsCutoffMode.Manual && cutoffRadius !== undefined
            ? { cutoffRadius }
            : {}),
        coordinationDeficit: toPositiveInteger(
            presetConfig?.coordinationDeficit,
            DEFAULT_SURFACE_COORDINATION_DEFICIT
        ),
        anisotropyThreshold: toUnitInterval(
            presetConfig?.anisotropyThreshold,
            DEFAULT_SURFACE_ANISOTROPY_THRESHOLD
        ),
        byType: presetConfig?.byType === undefined ? true : Boolean(presetConfig.byType)
    };
};

const buildPropertyCondition = (input: {
    property?: string;
    operator?: string;
    value?: string | number;
    exposureId?: string;
}): ParticleFilterCondition => {
    return {
        kind: ParticleFilterConditionKind.Property,
        property: input.property || '',
        operator: resolveFilterOperator(input.operator),
        value: Number(input.value ?? 0),
        ...(input.exposureId ? { exposureId: input.exposureId } : {})
    };
};

const buildPresetCondition = (input: {
    preset?: ParticleFilterPreset;
    presetConfig?: SurfaceAtomsPresetConfigDTO;
}): ParticleFilterCondition => {
    return {
        kind: ParticleFilterConditionKind.Preset,
        preset: input.preset === ParticleFilterPreset.SurfaceAtoms
            ? ParticleFilterPreset.SurfaceAtoms
            : ParticleFilterPreset.SurfaceAtoms,
        presetConfig: resolveSurfaceAtomsPresetConfig(input.presetConfig)
    };
};

const resolveCondition = (condition: ParticleFilterConditionDTO): ParticleFilterCondition => {
    if (condition.kind === ParticleFilterConditionKind.Preset) {
        return buildPresetCondition(condition);
    }

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

    if (input.mode === ParticleFilterMode.Preset) {
        return {
            combinator: ParticleFilterCombinator.And,
            conditions: [buildPresetCondition(input)]
        };
    }

    return {
        combinator: input.combinator || ParticleFilterCombinator.And,
        conditions: [buildPropertyCondition(input)]
    };
};
