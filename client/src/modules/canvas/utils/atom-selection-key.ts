
export const buildAtomSelectionKey = (
    trajectoryId: string | undefined,
    timestep: number | undefined
): string | null => {
    if (!trajectoryId || timestep === undefined) return null;
    return `${trajectoryId}:${timestep}`;
};
