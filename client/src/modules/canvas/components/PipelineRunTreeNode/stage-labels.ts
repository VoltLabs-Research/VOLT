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

const CHAIN_SEPARATOR = ' → ';

const MAX_CHAIN_PARTS = 3;

const describeRunChain = (
    rows: readonly { kind: string; stage?: PipelineRunStage }[]
): string => {
    const names = rows
        .filter((row) => row.stage?.kind === 'plugin')
        .map((row) => row.stage?.pluginDisplayName?.trim())
        .filter((name): name is string => Boolean(name));

    if (names.length === 0) {
        return 'Pipeline run';
    }

    if (names.length <= MAX_CHAIN_PARTS) {
        return names.join(CHAIN_SEPARATOR);
    }

    const shown = names.slice(0, MAX_CHAIN_PARTS).join(CHAIN_SEPARATOR);
    return `${shown} +${names.length - MAX_CHAIN_PARTS}`;
};

export const resolveRunLabel = (
    run: { name?: string | null } | undefined,
    rows: readonly { kind: string; stage?: PipelineRunStage }[]
): string => run?.name?.trim() || describeRunChain(rows);
