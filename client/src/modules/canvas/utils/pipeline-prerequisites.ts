import type { IArgumentDefinition } from '@volt/contracts/modules/plugin/domain/workflow';

export interface PrerequisiteStage {
    pluginKey: string;
    pluginName: string;
    requires: string[][];
}

export interface UnsatisfiedPrerequisite {
    pluginName: string;
    missing: string[][];
}

export const collectRequiredPluginGroups = (args: IArgumentDefinition[]): string[][] => {
    const groups = args
        .map((arg) => (arg.plugins ?? []).filter((key) => key.length > 0))
        .filter((group) => group.length > 0);

    const seen = new Set<string>();
    return groups.filter((group) => {
        const fingerprint = group.join('\u0000');
        if (seen.has(fingerprint)) return false;
        seen.add(fingerprint);
        return true;
    });
};

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

export const formatPrerequisiteNames = (
    missing: string[][],
    nameByKey: Map<string, string>
): string => {
    const labels = missing.map((group) =>
        group.map((key) => nameByKey.get(key) ?? key).join(' or ')
    );
    return labels.join('; ');
};

