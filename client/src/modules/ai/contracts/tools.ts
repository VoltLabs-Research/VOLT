import type { NavigateFunction } from 'react-router-dom';
import type { QueryClient } from '@tanstack/react-query';

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
    navigate: NavigateFunction;
    queryClient: QueryClient;
    
    getCanvasBridge: () => CanvasBridgeSnapshot;
    
    markViewerActing: () => void;
}

export interface ClientToolResult {
    ok: boolean;
    summary: string;
    reason?: string;
    hint?: string;
    data?: unknown;
}

export interface ClientToolEffectDescription {
    
    label: string;
    
    icon?: string;
}

export interface ClientToolHandler<TInput = Record<string, unknown>> {
    
    readonly name: string;
    
    readonly needsViewer?: boolean;
    
    run(input: TInput, ctx: ClientToolContext): Promise<ClientToolResult> | ClientToolResult;
    
    describeEffect?(input: TInput, result: ClientToolResult): ClientToolEffectDescription;
}

export interface ClientToolModule {
    default: ClientToolHandler;
}


export interface ToolApprovalResponseParams {
    id: string;
    approved: boolean;
    reason?: string;
}
