import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';

/**
 * Pre-run prerequisite check for the canvas pipeline.
 *
 * Some plugins (e.g. OpenDXA, Elastic Strain) only work when an upstream
 * structure-identification plugin (PTM/ACNA/PSM) ran first — the daemon rejects
 * them otherwise. A plugin declares this on its `inferFromContext` arguments via
 * `plugins: string[]` (prerequisite plugin KEYS, any-of). We surface the missing
 * prerequisite as a warning BEFORE dispatch instead of letting the user discover
 * it from a failed run.
 */

export interface PrerequisiteStage {
    /** Plugin key (modifier.data.key) of the analysis stage, in pipeline order. */
    pluginKey: string;
    /** Display name for the warning message. */
    pluginName: string;
    /** Prerequisite key groups; each inner group is satisfied by ANY one key. */
    requires: string[][];
}

export interface UnsatisfiedPrerequisite {
    pluginName: string;
    /** The unmet groups (each a list of acceptable prerequisite keys). */
    missing: string[][];
}

/**
 * Collects the prerequisite key groups a plugin declares across its arguments.
 * One group per argument that carries a non-empty `plugins` list.
 */
export const collectRequiredPluginGroups = (args: IArgumentDefinition[]): string[][] =>
    args
        .map((arg) => (arg.plugins ?? []).filter((key) => key.length > 0))
        .filter((group) => group.length > 0);

/**
 * Walks the ordered analysis stages and returns those whose prerequisites are
 * not satisfied by an EARLIER stage in the same run. A group is satisfied when
 * any one of its keys appears earlier.
 */
export const findUnsatisfiedPrerequisites = (
    stages: PrerequisiteStage[]
): UnsatisfiedPrerequisite[] => {
    const unsatisfied: UnsatisfiedPrerequisite[] = [];
    const seen = new Set<string>();

    for (const stage of stages) {
        const missing = stage.requires.filter((group) => !group.some((key) => seen.has(key)));
        if (missing.length > 0) {
            unsatisfied.push({ pluginName: stage.pluginName, missing });
        }
        seen.add(stage.pluginKey);
    }

    return unsatisfied;
};

/** Human-readable list of acceptable prerequisite names for a warning. */
export const formatPrerequisiteNames = (
    missing: string[][],
    nameByKey: Map<string, string>
): string => {
    const labels = missing.map((group) =>
        group.map((key) => nameByKey.get(key) ?? key).join(' or ')
    );
    return labels.join('; ');
};

