export type CanvasAccessMode = 'rbac' | 'public';

export interface CanvasAccessState {
    mode: CanvasAccessMode;
    trajectoryId: string | undefined;
    teamId: string | undefined;
    canMutate: boolean;
    canCollaborate: boolean;
    isGuest: boolean;
    hasTeamMembership: boolean;
}

export const DEFAULT_CANVAS_ACCESS_STATE: CanvasAccessState = {
    mode: 'rbac',
    trajectoryId: undefined,
    teamId: undefined,
    canMutate: true,
    canCollaborate: true,
    isGuest: false,
    hasTeamMembership: true
};
