import { getClientTool } from '@/modules/ai/tools/registry';
import { useCanvasBridgeStore } from '@/modules/canvas/store/use-canvas-bridge-store';
import type { ClientToolContext, ClientToolResult } from '@/modules/ai/contracts/tools';
import type { BrowserToolInvocation } from '@volt/contracts/modules/ai/socket';

// open_in_viewer navigates and returns at once, while the canvas still loads: a viewer tool called
// right after it waits this long for the viewer to come up before reporting that none is open.
const VIEWER_WAIT_MS = 30_000;

const viewerMounted = (): boolean => useCanvasBridgeStore.getState().getSnapshot().mounted;

const waitForViewer = (timeoutMs: number): Promise<boolean> => {
    if (viewerMounted()) return Promise.resolve(true);

    return new Promise((resolve) => {
        const timer = window.setTimeout(() => {
            unsubscribe();
            resolve(viewerMounted());
        }, timeoutMs);
        const unsubscribe = useCanvasBridgeStore.subscribe(() => {
            if (!viewerMounted()) return;

            window.clearTimeout(timer);
            unsubscribe();
            resolve(true);
        });
    });
};

export const runBrowserTool = async (invocation: BrowserToolInvocation, context: ClientToolContext): Promise<ClientToolResult> => {
    const handler = getClientTool(invocation.toolName);
    if (!handler) {
        return {
            ok: false,
            summary: `This version of VOLT cannot run ${invocation.toolName} in the browser.`,
            reason: 'unknown_browser_tool',
            hint: 'Ask the user to reload VOLT.'
        };
    }

    try {
        if (handler.needsViewer && !await waitForViewer(VIEWER_WAIT_MS)) {
            return {
                ok: false,
                summary: 'The 3D viewer is not open.',
                reason: 'viewer_not_mounted',
                hint: 'Open a trajectory in the canvas first (open_in_viewer), then retry.'
            };
        }

        return await handler.run(invocation.input as Record<string, unknown>, context);
    } catch (error: unknown) {
        return {
            ok: false,
            summary: 'The action failed to run in the browser.',
            reason: 'client_tool_error',
            hint: error instanceof Error ? error.message : String(error)
        };
    }
};
