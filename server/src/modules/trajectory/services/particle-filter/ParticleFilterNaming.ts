import type { ParticleFilterRequest } from '@modules/trajectory/services/particle-filter/ParticleFilterRequest';
import { formatValueForPath } from '@shared/infrastructure/utilities/format-value';
import { createHash } from 'node:crypto';

const DEFAULT_ANALYSIS_ID = 'default';

interface SingleConditionObjectNameParams{
    trajectoryId: string;
    analysisSegment?: string;
    timestep: string | number;
    exposureId?: string;
    property: string;
    operator: string;
    value: number | string;
    action: string;
}

const buildSingleConditionObjectName = ({
    trajectoryId,
    analysisSegment,
    timestep,
    exposureId,
    property,
    operator,
    value,
    action
}: SingleConditionObjectNameParams): string => {
    const segment = analysisSegment || DEFAULT_ANALYSIS_ID;
    const formattedValue = typeof value === 'number' ? formatValueForPath(value) : value;
    const exposurePart = exposureId || 'dump';
    return `trajectory-${trajectoryId}/analysis-${segment}/glb/${timestep}/particle-filter/${exposurePart}/${property}-${operator}-${formattedValue}-${action}.glb.zst`;
};

export const buildParticleFilterObjectName = (
    trajectoryId: string,
    analysisId: string | undefined,
    timestep: string | number,
    request: ParticleFilterRequest,
    action: string
): string => {
    if (request.conditions.length === 1) {
        const condition = request.conditions[0];
        return buildSingleConditionObjectName({
            trajectoryId,
            analysisSegment: analysisId,
            timestep,
            exposureId: condition.exposureId,
            property: condition.property,
            operator: condition.operator,
            value: condition.value,
            action
        });
    }

    const filterHash = createHash('sha1').update(JSON.stringify(request)).digest('hex').slice(0, 12);
    const segment = analysisId || DEFAULT_ANALYSIS_ID;

    return `trajectory-${trajectoryId}/analysis-${segment}/glb/${timestep}/particle-filter/composite/${request.combinator.toLowerCase()}-${filterHash}-${action}.glb.zst`;
};

export const buildParticleFilterArtifactParams = (
    request: ParticleFilterRequest,
    action: string
): Record<string, unknown> => {
    const firstCondition = request.conditions[0];
    const params: Record<string, unknown> = {
        combinator: request.combinator,
        conditions: request.conditions,
        action
    };

    if (request.conditions.length === 1 && firstCondition) {
        params.property = firstCondition.property;
        params.operator = firstCondition.operator;
        params.value = firstCondition.value;
        params.exposureId = firstCondition.exposureId;
    }

    return params;
};

export const buildParticleFilterDisplayName = (
    request: ParticleFilterRequest,
    action: string,
    timestep: string | number
): string => {
    const conditionsLabel = request.conditions.map((condition) => {
        const sourcePrefix = condition.exposureId ? `${condition.exposureId}:` : '';
        return `${sourcePrefix}${condition.property} ${condition.operator} ${condition.value}`;
    }).join(` ${request.combinator} `);

    return `PF · ${conditionsLabel} · ${action} · t=${timestep}`;
};
