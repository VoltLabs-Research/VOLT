import type { FlatAtomProperties } from '@modules/plugin/services/properties/PluginAtomProperties';
import { normalizeAtomId } from '@modules/plugin/services/properties/PluginAtomProperties';
import type { PluginAnalysisAllAtomsResponse } from '@modules/plugin/services/properties/PluginPropertyStore';


export interface ExposurePropertyRows {
    exposureId: string;
    propertyNames: string[];
    rows: FlatAtomProperties[];
}

export const mergeExposureRows = (
    exposures: ExposurePropertyRows[],
    atomIds?: Set<number>
): PluginAnalysisAllAtomsResponse => {
    const propertyNames: string[] = [];
    const declaredProperties = new Set<string>();
    const mergedAtoms = new Map<number, FlatAtomProperties>();

    for (const exposure of exposures) {
        for (const property of exposure.propertyNames) {
            if (declaredProperties.has(property)) continue;
            declaredProperties.add(property);
            propertyNames.push(property);
        }

        for (const row of exposure.rows) {
            const atomId = normalizeAtomId(row.id);
            if (atomId === null) continue;
            if (atomIds && !atomIds.has(atomId)) continue;

            const atom = mergedAtoms.get(atomId) ?? { id: atomId };
            for (const property of exposure.propertyNames) {
                if (row[property] !== undefined) {
                    atom[property] = row[property];
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
