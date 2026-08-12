import type { FlatAtomProperties } from '@modules/plugin/services/properties/PluginAtomProperties';
import { normalizeAtomId } from '@modules/plugin/services/properties/PluginAtomProperties';
import type { PluginAnalysisAllAtomsResponse } from '@modules/plugin/services/properties/PluginPropertyStore';


export interface ExposurePropertyRows {
    exposureId: string;
    propertyNames: string[];
    rows: FlatAtomProperties[];
}

const countPropertyOccurrences = (exposures: ExposurePropertyRows[]): Map<string, number> => {
    const occurrences = new Map<string, number>();
    for (const exposure of exposures) {
        for (const property of exposure.propertyNames) {
            occurrences.set(property, (occurrences.get(property) ?? 0) + 1);
        }
    }
    return occurrences;
};

export const mergeExposureRows = (
    exposures: ExposurePropertyRows[],
    atomIds?: Set<number>
): PluginAnalysisAllAtomsResponse => {
    const propertyOccurrences = countPropertyOccurrences(exposures);
    const propertyNames: string[] = [];
    const mergedAtoms = new Map<number, FlatAtomProperties>();

    for (const exposure of exposures) {
        const displayNames = new Map<string, string>();
        for (const property of exposure.propertyNames) {
            const displayName = (propertyOccurrences.get(property) ?? 0) > 1
                ? `${exposure.exposureId}: ${property}`
                : property;
            displayNames.set(property, displayName);
            propertyNames.push(displayName);
        }

        for (const row of exposure.rows) {
            const atomId = normalizeAtomId(row.id);
            if (atomId === null) continue;
            if (atomIds && !atomIds.has(atomId)) continue;

            const atom = mergedAtoms.get(atomId) ?? { id: atomId };
            for (const [source, display] of displayNames) {
                if (row[source] !== undefined) {
                    atom[display] = row[source];
                }
            }
            mergedAtoms.set(atomId, atom);
        }
    }

    return {
        propertyNames,
        atoms: Array.from(mergedAtoms.values()).sort((left, right) => Number(left.id) - Number(right.id))
    };
};
