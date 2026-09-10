export type CanvasAccessMode = 'rbac' | 'public';

export interface CanvasAccessState {
    mode: CanvasAccessMode;
    trajectoryId: string | undefined;
    canCollaborate: boolean;
}

export const DEFAULT_CANVAS_ACCESS_STATE: CanvasAccessState = {
    mode: 'rbac',
    trajectoryId: undefined,
    canCollaborate: true
};
