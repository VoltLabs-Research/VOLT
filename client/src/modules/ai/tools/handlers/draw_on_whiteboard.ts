import {
    useWhiteboardEditorHandleStore
} from '@/modules/whiteboards/stores/use-whiteboard-editor-handle-store';
import type {
    WhiteboardDrawElement,
    WhiteboardEditorHandleSnapshot
} from '@/modules/whiteboards/stores/use-whiteboard-editor-handle-store';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/tools/types';

interface DrawOnWhiteboardInput {
    whiteboardId?: string;
    mode?: 'append' | 'replace';
    elements?: WhiteboardDrawElement[];
}

/** Max time to wait for the editor (and its lazy Excalidraw chunk) after navigating. */
const READINESS_TIMEOUT_MS = 6000;
const READINESS_POLL_MS = 120;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const readSnapshot = (): WhiteboardEditorHandleSnapshot =>
    useWhiteboardEditorHandleStore.getState().getSnapshot();

/**
 * Waits until the editor handle is registered, open on `whiteboardId`, and the
 * Excalidraw API is live — or times out. The board route lazy-loads the canvas,
 * so a fresh navigation needs a beat before `draw` is callable.
 */
const waitForReadyEditor = async (whiteboardId: string): Promise<WhiteboardEditorHandleSnapshot> => {
    const deadline = Date.now() + READINESS_TIMEOUT_MS;

    for (;;) {
        const snapshot = readSnapshot();
        if (snapshot.ready && snapshot.whiteboardId === whiteboardId) {
            return snapshot;
        }
        if (Date.now() >= deadline) {
            return snapshot;
        }
        await delay(READINESS_POLL_MS);
    }
};

/**
 * Draws AI-authored content onto a whiteboard's live Excalidraw canvas. The
 * model supplies a high-level element list; the editor page (via the
 * whiteboard-editor-handle store) converts it to real elements and applies it,
 * which propagates to all collaborators through the existing sync path. If the
 * board is not already open we navigate to it first and wait for the canvas.
 */
const drawOnWhiteboard: ClientToolHandler<DrawOnWhiteboardInput> = {
    name: 'draw_on_whiteboard',

    async run(input, ctx): Promise<ClientToolResult> {
        const whiteboardId = typeof input.whiteboardId === 'string' ? input.whiteboardId.trim() : '';
        const elements = Array.isArray(input.elements) ? input.elements : [];
        const mode = input.mode === 'replace' ? 'replace' : 'append';

        if (!whiteboardId) {
            return {
                ok: false,
                summary: 'Could not draw on the whiteboard.',
                reason: 'missing_whiteboard_id',
                hint: 'A whiteboardId is required. Create one with create_whiteboard or resolve one with list_whiteboards first.'
            };
        }

        if (elements.length === 0) {
            return {
                ok: false,
                summary: 'No elements to draw.',
                reason: 'empty_elements',
                hint: 'Provide at least one element (rectangle/ellipse/diamond/text/arrow/line) to draw.'
            };
        }

        const current = readSnapshot();
        if (current.whiteboardId !== whiteboardId) {
            ctx.navigate(`/dashboard/whiteboard/${encodeURIComponent(whiteboardId)}`);
        }

        const snapshot = await waitForReadyEditor(whiteboardId);
        if (!snapshot.ready || !snapshot.draw || snapshot.whiteboardId !== whiteboardId) {
            return {
                ok: false,
                summary: 'The whiteboard editor did not open in time.',
                reason: 'whiteboard_not_ready',
                hint: 'The board could not be opened (it may not exist or you may lack access). Verify the whiteboardId, then retry.'
            };
        }

        const result = snapshot.draw({ mode, elements });

        return {
            ok: true,
            summary: `Drew ${result.drawn} element${result.drawn === 1 ? '' : 's'} on the whiteboard.`,
            data: { whiteboardId, mode, drawn: result.drawn }
        };
    },

    describeEffect(_input, result) {
        if (!result.ok) {
            return { label: 'Could not draw on whiteboard', icon: 'whiteboard' };
        }
        const drawn = (result.data as { drawn?: number } | undefined)?.drawn ?? 0;
        return { label: `Drew ${drawn} element${drawn === 1 ? '' : 's'} on the whiteboard`, icon: 'whiteboard' };
    }
};

export default drawOnWhiteboard;
