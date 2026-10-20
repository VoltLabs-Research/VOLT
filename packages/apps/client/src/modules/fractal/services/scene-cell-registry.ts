import { Box3 } from 'three';

const sceneCellBases = new Map<string, Box3>();

export const registerSceneCellBase = (sceneKey: string, baseBox: Box3): void => {
    const existing = sceneCellBases.get(sceneKey);
    if (existing) {
        existing.copy(baseBox);
        return;
    }

    sceneCellBases.set(sceneKey, baseBox.clone());
};

export const unregisterSceneCellBase = (sceneKey: string): void => {
    sceneCellBases.delete(sceneKey);
};

export const getSceneCellBase = (sceneKey: string): Box3 | undefined => sceneCellBases.get(sceneKey);

export const getSceneCellBases = (): ReadonlyMap<string, Box3> => sceneCellBases;
