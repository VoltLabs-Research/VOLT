import type { Excalidraw } from '@excalidraw/excalidraw';
import type { ComponentProps } from 'react';

export type ExcalidrawProps = ComponentProps<typeof Excalidraw>;

export type ExcalidrawAPICallback = NonNullable<ExcalidrawProps['excalidrawAPI']>;

export type ExcalidrawAPI = Parameters<ExcalidrawAPICallback>[0];

export type ExcalidrawChangeHandler = NonNullable<ExcalidrawProps['onChange']>;

export type ExcalidrawChangeElements = Parameters<ExcalidrawChangeHandler>[0];

export type ExcalidrawChangeAppState = Parameters<ExcalidrawChangeHandler>[1];

export type ExcalidrawChangeFiles = Parameters<ExcalidrawChangeHandler> extends [unknown, unknown, infer TFiles, ...unknown[]]
    ? TFiles
    : Record<string, unknown>;

export type RenderTopRightUI = NonNullable<ExcalidrawProps['renderTopRightUI']>;

export type WhiteboardElement = {
    id: string;
    version: number;
    versionNonce: number;
    updated: number;
    isDeleted?: boolean;
    fileId?: string | null;
    [key: string]: unknown;
};

export type WhiteboardElements = WhiteboardElement[];

export type WhiteboardAppState = Record<string, unknown>;

export type WhiteboardFiles = Record<string, unknown>;

export interface WhiteboardScene {
    elements: WhiteboardElements;
    appState: WhiteboardAppState;
};

/** A scene together with the image cache Excalidraw keeps beside it, as our API stores it. */
export interface WhiteboardStoredScene extends WhiteboardScene {
    files?: WhiteboardFiles;
};

/** A scene as our realtime channel broadcasts it. */
export interface WhiteboardScenePayload extends WhiteboardScene {
    whiteboardId: string;
    revision: number;
    elementOrder?: string[];
    clientId?: string;
};
