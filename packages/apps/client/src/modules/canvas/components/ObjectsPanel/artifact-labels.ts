import type { SceneArtifact, SceneArtifactParams } from '@volt/contracts/modules/trajectory/domain';

const PARTICLE_FILTER_ACTION_LABELS = {
    delete: 'Delete',
    highlight: 'Color Selection'
} as const;

const formatArtifactValue = (value: number | string): string => {
    if (typeof value !== 'number') return value;
    if (Number.isInteger(value)) return String(value);
    return String(Number(value.toFixed(3)));
};

const formatParticleFilterConditionLabel = (condition: SceneArtifactParams): string => {
    if (condition.property === undefined || condition.operator === undefined || condition.value === undefined) {
        return '';
    }
    return `${condition.property} ${condition.operator} ${formatArtifactValue(condition.value)}`;
};

const formatParticleFilterArtifactLabel = (artifact: SceneArtifact): string => {
    const { params, displayName } = artifact;
    const baseCondition = params.conditions?.length
        ? formatParticleFilterConditionLabel(params.conditions[0])
        : formatParticleFilterConditionLabel(params);

    if (!baseCondition) return displayName;

    const extraConditions = (params.conditions?.length ?? 0) > 1
        ? `+${(params.conditions?.length ?? 0) - 1} more`
        : '';
    const actionLabel = params.action ? PARTICLE_FILTER_ACTION_LABELS[params.action] : '';

    return [baseCondition, extraConditions, actionLabel].filter(Boolean).join(' · ');
};

const capitalizeProperty = (property: string): string => {
    return property.charAt(0).toUpperCase() + property.slice(1);
};

const formatColorCodingArtifactLabel = (artifact: SceneArtifact): string => {
    const { params, displayName } = artifact;

    if (
        params.property === undefined
        || params.startValue === undefined
        || params.endValue === undefined
    ) {
        return displayName;
    }

    const rangeLabel = `Range: [${formatArtifactValue(params.startValue)}, ${formatArtifactValue(params.endValue)}]`;
    const gradientLabel = params.gradient ?? '';

    return [capitalizeProperty(params.property), rangeLabel, gradientLabel].filter(Boolean).join(' · ');
};

export const formatArtifactLabel = (artifact: SceneArtifact): string => {
    if (artifact.sourceType === 'particle-filter') return formatParticleFilterArtifactLabel(artifact);
    if (artifact.sourceType === 'color-coding') return formatColorCodingArtifactLabel(artifact);
    return artifact.displayName;
};

export const pruneExpandedTimesteps = (current: Set<number>, availableTimesteps: number[]): Set<number> => {
    if (current.size === 0) return current;
    if (availableTimesteps.length === 0) return new Set();

    const available = new Set(availableTimesteps);
    let changed = false;
    const next = new Set<number>();

    for (const timestep of current) {
        if (available.has(timestep)) next.add(timestep);
        else changed = true;
    }

    return changed ? next : current;
};
