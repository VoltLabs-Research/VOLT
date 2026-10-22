import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import socketService from '@/modules/socket/services/socket-service';
import { useCanvasBridgeStore } from '@/modules/canvas/store/use-canvas-bridge-store';
import { runBrowserTool } from '@/modules/ai/services/browser-tools';
import { AI_CHAT_EVENTS } from '@volt/contracts/modules/ai/socket';
import type { BrowserToolInvocation, BrowserToolResult } from '@volt/contracts/modules/ai/socket';
import type { ClientToolContext } from '@/modules/ai/contracts/tools';

// Answers the server when a turn calls a tool that runs in this tab. Mounted once for the signed-in
// app, beside the router, so it keeps answering on every page, the canvas included.
const useBrowserToolBridge = (): void => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const context = useMemo<Omit<ClientToolContext, 'conversation'>>(() => ({
        navigate,
        queryClient,
        getCanvasBridge: () => useCanvasBridgeStore.getState().getSnapshot(),
        markViewerActing: () => useCanvasBridgeStore.getState().markActing()
    }), [navigate, queryClient]);

    const contextRef = useRef(context);
    useEffect(() => {
        contextRef.current = context;
    }, [context]);

    useEffect(() => socketService.on<[BrowserToolInvocation, ((result: BrowserToolResult) => void) | undefined]>(
        AI_CHAT_EVENTS.toolInvoke,
        (invocation, answer) => {
            void runBrowserTool(invocation, {
                ...contextRef.current,
                conversation: {
                    conversationId: invocation.conversationId,
                    teamId: invocation.teamId
                }
            }).then((result) => answer?.(result));
        }
    ), []);
};

export default useBrowserToolBridge;
