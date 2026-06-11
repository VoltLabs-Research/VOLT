export interface CanvasWorkspaceStatePatch {
    [key: string]: unknown;
}

export interface CanvasWorkspaceSnapshot {
    trajectoryId: string;
    ownerId: string;
    revision: number;
    state: CanvasWorkspaceStatePatch;
    updatedAt: number;
}

export interface CanvasWorkspaceApplyResult {
    revision: number;
    state: CanvasWorkspaceStatePatch;
    delta: CanvasWorkspaceStatePatch;
}

export interface ICanvasWorkspaceRealtimeStateService {
    getSnapshot(trajectoryId: string, ownerId: string): Promise<CanvasWorkspaceSnapshot | null>;
    replaceSnapshot(
        trajectoryId: string,
        ownerId: string,
        state: CanvasWorkspaceStatePatch
    ): Promise<CanvasWorkspaceSnapshot>;
    applyPatch(
        trajectoryId: string,
        ownerId: string,
        patch: CanvasWorkspaceStatePatch
    ): Promise<CanvasWorkspaceApplyResult>;
    release(trajectoryId: string, ownerId: string): Promise<void>;
    listOwners(trajectoryId: string): Promise<string[]>;
}
