import crypto from 'node:crypto';

const stableStringify = (value: unknown): string => {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value) ?? 'null';
    }

    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }

    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
        `${JSON.stringify(key)}:${stableStringify(record[key])}`
    ).join(',')}}`;
};

export interface PipelineStageHashInput {
    trajectoryId: string;
    selectedTimesteps?: number[];
    upstreamStageHashes: string[];
    pluginId: string;
    config: Record<string, unknown>;
}

export const computePipelineStageHash = (input: PipelineStageHashInput): string => {
    const normalizedTimesteps = input.selectedTimesteps
        ? [...new Set(input.selectedTimesteps)].sort((left, right) => left - right)
        : null;

    return crypto
        .createHash('sha256')
        .update(stableStringify({
            trajectoryId: input.trajectoryId,
            selectedTimesteps: normalizedTimesteps,
            upstreamStageHashes: input.upstreamStageHashes,
            pluginId: input.pluginId,
            config: input.config
        }))
        .digest('hex')
        .slice(0, 24);
};

export const computeDumpStageHash = (kind: string, config: Record<string, unknown>): string => {
    return crypto
        .createHash('sha256')
        .update(stableStringify({ kind, config }))
        .digest('hex')
        .slice(0, 24);
};
