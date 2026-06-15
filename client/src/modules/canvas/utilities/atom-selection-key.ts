/**
 * Frame-stable key for the per-atom selection store. Atom ids are unique within
 * a (trajectory, timestep) frame, so the selection set is scoped by this key —
 * navigating to a different frame swaps the visible selection, and returning to
 * a frame restores it. Both the 3D viewer (pick) and the atom table (row click)
 * derive the key the same way so their writes land in the same set.
 *
 * Deliberately NOT the scene key (`default-trajectory`): that is frame-agnostic
 * and would bleed one frame's selection onto every frame.
 */
export const buildAtomSelectionKey = (
    trajectoryId: string | undefined,
    timestep: number | undefined
): string | null => {
    if (!trajectoryId || timestep === undefined) return null;
    return `${trajectoryId}:${timestep}`;
};
