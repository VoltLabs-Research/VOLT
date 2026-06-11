export type WhiteboardElement = Record<string, unknown>;
export type WhiteboardAppState = Record<string, unknown>;

export interface WhiteboardSceneSnapshot {
    whiteboardId: string;
    revision: number;
    elements: WhiteboardElement[];
    appState: WhiteboardAppState;
}

export interface WhiteboardSceneDelta {
    whiteboardId: string;
    revision: number;
    elements: WhiteboardElement[];
    appState: WhiteboardAppState;
    elementOrder?: string[];
}

export interface MergeSceneResult {
    changed: boolean;
    revision: number;
    delta?: WhiteboardSceneDelta;
}

export interface IWhiteboardRealtimeStateService {
    getSnapshot(whiteboardId: string): Promise<WhiteboardSceneSnapshot | null>;
    getTeamId(whiteboardId: string): Promise<string | null>;
    mergeScene(
        whiteboardId: string,
        elements: WhiteboardElement[],
        appState: WhiteboardAppState,
        userId: string,
        elementOrder?: string[]
    ): Promise<MergeSceneResult | null>;
    flushAndRelease(whiteboardId: string): Promise<void>;
}
