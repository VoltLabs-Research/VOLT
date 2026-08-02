import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';

/**
 * An Excalidraw element as it travels between the client, this server and object
 * storage. Only the fields the merge rules arbitrate on are named; the rest of the
 * payload is carried through untouched.
 */
export interface WhiteboardElement{
    id: string;
    version?: number;
    updated?: number;
    versionNonce?: number;
    [key: string]: unknown;
}

export type WhiteboardAppState = Record<string, unknown>;

export interface WhiteboardScene{
    revision: number;
    elements: WhiteboardElement[];
    appState: WhiteboardAppState;
}

export interface WhiteboardSceneSnapshot extends WhiteboardScene{
    whiteboardId: string;
}

export interface WhiteboardSceneDelta extends WhiteboardSceneSnapshot{
    elementOrder?: string[];
}

export const EMPTY_WHITEBOARD_SCENE: WhiteboardScene = {
    revision: 0,
    elements: [],
    appState: {}
};

export const requireWhiteboardStorageClusterId = (whiteboardId: string, storageClusterId?: string | null): string => {
    const trimmed = storageClusterId?.trim();
    if(trimmed){
        return trimmed;
    }

    throw ApplicationError.conflict(
        ErrorCodes.WHITEBOARD_STORAGE_CLUSTER_REQUIRED,
        `Whiteboard ${whiteboardId} does not have a storage cluster assigned`
    );
};

export const requireWhiteboardPayloadKey = (whiteboardId: string, payloadKey: string): string => {
    if(payloadKey){
        return payloadKey;
    }

    throw ApplicationError.conflict(
        ErrorCodes.WHITEBOARD_PAYLOAD_KEY_REQUIRED,
        `Whiteboard ${whiteboardId} does not have a payload key assigned`
    );
};
