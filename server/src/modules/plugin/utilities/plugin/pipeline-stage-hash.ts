import crypto from 'node:crypto';

// Deterministic JSON serialization with sorted object keys, so two
// structurally-equal configs hash identically regardless of key order. Mirrors
// the daemon's WorkflowRuntime.stableStringify so both ends agree on a content
// hash for a plugin run.
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
    // Sorted, de-duplicated timesteps the run targets (or undefined = all frames).
    selectedTimesteps?: number[];
    // The content hashes of every enabled stage that runs before this one, in
    // pipeline order. This is what makes the hash recompute-from-here: changing
    // an upstream slice/expression/plugin changes every downstream stage's hash.
    upstreamStageHashes: string[];
    pluginId: string;
    config: Record<string, unknown>;
}

// Content hash identifying a plugin stage's full input: the trajectory, the
// selected timesteps, the ordered upstream pipeline ops, and this plugin's id +
// config. Two pipeline runs that reach an identical stage produce the same hash,
// so a previously-completed analysis with this hash can be reused (cache hit).
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

// The per-stage content contribution of a NON-plugin (dump-mutating) stage —
// slice / expression. Folded into downstream plugin stages' upstreamStageHashes
// so a changed slice invalidates everything after it.
export const computeDumpStageHash = (kind: string, config: Record<string, unknown>): string => {
    return crypto
        .createHash('sha256')
        .update(stableStringify({ kind, config }))
        .digest('hex')
        .slice(0, 24);
};
