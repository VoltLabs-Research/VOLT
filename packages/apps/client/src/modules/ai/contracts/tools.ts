import type { NavigateFunction } from 'react-router-dom';
import type { QueryClient } from '@tanstack/react-query';
import type { BrowserToolResult } from '@volt/contracts/modules/ai/socket';

export interface CanvasBridgeSnapshot {
    mounted: boolean;
    trajectoryId: string | null;
    timesteps: number[];
    currentTimestep?: number;
    activeSceneId: string | null;

    resetCamera: (() => void) | null;
    zoomTo: ((zoomPercent: number) => void) | null;
}

export interface ClientToolContext {
    // The conversation whose turn called the tool, under the team that owns it.
    conversation: {
        conversationId: string;
        teamId: string;
    };
    navigate: NavigateFunction;
    queryClient: QueryClient;

    getCanvasBridge: () => CanvasBridgeSnapshot;

    markViewerActing: () => void;
}

export type ClientToolResult = BrowserToolResult;

export interface ClientToolHandler<TInput = Record<string, unknown>> {

    readonly name: string;

    readonly needsViewer?: boolean;

    run(input: TInput, ctx: ClientToolContext): Promise<ClientToolResult> | ClientToolResult;
}

export interface ClientToolModule {
    default: ClientToolHandler;
}
