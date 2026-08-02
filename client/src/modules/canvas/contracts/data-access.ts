export type CanvasAccessMode = 'rbac' | 'public';

export interface CanvasAccessState {
    mode: CanvasAccessMode;
    trajectoryId: string | undefined;
    canMutate: boolean;
    canCollaborate: boolean;
    isGuest: boolean;
    hasTeamMembership: boolean;
}

export const DEFAULT_CANVAS_ACCESS_STATE: CanvasAccessState = {
    mode: 'rbac',
    trajectoryId: undefined,
    canMutate: true,
    canCollaborate: true,
    isGuest: false,
    hasTeamMembership: true
};
