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

export type WhiteboardElement = Record<string, unknown>;

export type WhiteboardElements = WhiteboardElement[];

export type WhiteboardAppState = Record<string, unknown>;

export type WhiteboardFiles = Record<string, unknown>;
