import type { PipelineRunStage } from '@volt/contracts/modules/plugin/pipeline-run';

const KIND_LABELS: Record<PipelineRunStage['kind'], string> = {
    plugin: 'Analysis',
    slice: 'Slice Plane',
    expression: 'Expression Select'
};

const readString = (config: Record<string, unknown>, key: string): string | undefined => {
    const value = config[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const readNumber = (config: Record<string, unknown>, key: string): number | undefined => {
    const value = config[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const formatNumber = (value: number): string =>
    Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));

const formatNormal = (config: Record<string, unknown>): string | undefined => {
    const normal = config.normal;
    if (typeof normal !== 'object' || normal === null) return undefined;

    const { x, y, z } = normal as Record<string, unknown>;
    const parts = [x, y, z].map((component) =>
        typeof component === 'number' && Number.isFinite(component) ? formatNumber(component) : undefined
    );

    return parts.every((part): part is string => part !== undefined) ? parts.join(', ') : undefined;
};

/**
 * What a non-plugin stage did, short enough for a tree row. These stages carry no
 * name of their own — the transform *is* the label — so the config is where the
 * meaning lives.
 */
export const describePipelineRunStage = (stage: PipelineRunStage): string => {
    if (stage.kind === 'expression') {
        return readString(stage.config, 'expression') ?? KIND_LABELS.expression;
    }

    if (stage.kind === 'slice') {
        const normal = formatNormal(stage.config);
        const distance = readNumber(stage.config, 'distance');
        if (normal === undefined && distance === undefined) return KIND_LABELS.slice;

        const detail = [
            normal === undefined ? undefined : `n=(${normal})`,
            distance === undefined ? undefined : `d=${formatNumber(distance)}`
        ].filter((part): part is string => part !== undefined).join(' ');

        return `${KIND_LABELS.slice} · ${detail}`;
    }

    return stage.pluginDisplayName ?? KIND_LABELS.plugin;
};

export const pipelineRunStageKindLabel = (kind: PipelineRunStage['kind']): string => KIND_LABELS[kind];
