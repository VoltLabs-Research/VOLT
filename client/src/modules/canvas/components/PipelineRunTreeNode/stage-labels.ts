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

const CHAIN_SEPARATOR = ' → ';

/** Beyond this the chain stops being a name and starts being a paragraph. */
const MAX_CHAIN_PARTS = 3;

/**
 * A run's name: the plugins it ran, in order.
 *
 * Only plugin stages appear. A slice or expression stage describes *how* the
 * frame was prepared, which the expanded rows already say; putting it in the
 * title would push the plugin names — the part that identifies the run — out of
 * a narrow sidebar.
 */
export const describeRunChain = (
    rows: readonly { kind: string; stage?: PipelineRunStage }[]
): string => {
    const names = rows
        .filter((row) => row.stage?.kind === 'plugin')
        .map((row) => row.stage?.pluginDisplayName?.trim())
        .filter((name): name is string => Boolean(name));

    if (names.length === 0) {
        // Every stage was a transform, or none carried a name.
        return 'Pipeline run';
    }

    if (names.length <= MAX_CHAIN_PARTS) {
        return names.join(CHAIN_SEPARATOR);
    }

    const shown = names.slice(0, MAX_CHAIN_PARTS).join(CHAIN_SEPARATOR);
    return `${shown} +${names.length - MAX_CHAIN_PARTS}`;
};
