import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCanvasBridgeStore } from '@/modules/canvas/store/use-canvas-bridge-store';
import { getClientTool } from '@/modules/ai/tools/registry';
import type { ClientToolContext, ClientToolResult } from '@/modules/ai/contracts/tools';

export interface ClientToolCall {
    toolCallId: string;
    toolName: string;
    input: unknown;
}

export type AddToolResultFn = (args: { tool: string; toolCallId: string; output: unknown }) => void | Promise<void>;

export const useClientToolDispatch = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const context = useMemo<ClientToolContext>(() => ({
        navigate,
        queryClient,
        getCanvasBridge: () => useCanvasBridgeStore.getState().getSnapshot(),
        markViewerActing: () => useCanvasBridgeStore.getState().markActing()
    }), [navigate, queryClient]);

    return useCallback(async (toolCall: ClientToolCall, addToolResult: AddToolResultFn): Promise<void> => {
        const handler = getClientTool(toolCall.toolName);

        if (!handler) {
            return;
        }

        let output: ClientToolResult;
        try {
            if (handler.needsViewer && !context.getCanvasBridge().mounted) {
                output = {
                    ok: false,
                    summary: 'The 3D viewer is not open.',
                    reason: 'viewer_not_mounted',
                    hint: 'Open a trajectory in the canvas first (open_in_viewer), then retry.'
                };
            } else {
                output = await handler.run(toolCall.input as Record<string, unknown>, context);
            }
        } catch (error) {
            output = {
                ok: false,
                summary: 'The action failed to run in the browser.',
                reason: 'client_tool_error',
                hint: error instanceof Error ? error.message : String(error)
            };
        }

        await addToolResult({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output
        });
    }, [context]);
};
