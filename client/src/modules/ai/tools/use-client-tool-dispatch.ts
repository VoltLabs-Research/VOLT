import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCanvasBridgeStore } from '@/modules/canvas/stores/use-canvas-bridge-store';
import { getClientTool } from '@/modules/ai/tools/registry';
import type { ClientToolContext, ClientToolResult } from '@/modules/ai/tools/types';

/**
 * Minimal shape of a streamed client tool call (a subset of the SDK's
 * `InferUIMessageToolCall`). The model supplies `input`; we resolve `toolName`
 * against the client registry.
 */
export interface ClientToolCall {
    toolCallId: string;
    toolName: string;
    input: unknown;
}

/** Adds the resolved output back into the chat stream so the agent loop continues. */
export type AddToolResultFn = (args: { tool: string; toolCallId: string; output: unknown }) => void | Promise<void>;

/**
 * Builds the dispatcher that `useChat.onToolCall` calls for every streamed tool
 * call. Server-executed tools never reach here (they resolve on the server);
 * only `clientExecuted` tools are streamed out for the browser to run. We look
 * the name up in the registry, run the handler against the shared context, and
 * ALWAYS `addToolResult` — even on failure — so a tool call is never left
 * unresolved (which would stall `sendAutomaticallyWhen`).
 */
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

        // Not a client tool → it executed server-side; nothing to do here.
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
