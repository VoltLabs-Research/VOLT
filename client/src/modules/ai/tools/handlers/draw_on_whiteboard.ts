import {
    useWhiteboardEditorHandleStore
} from '@/modules/whiteboards/store/use-whiteboard-editor-handle-store';
import type {
    WhiteboardDrawElement,
    WhiteboardEditorHandleSnapshot
} from '@/modules/whiteboards/store/use-whiteboard-editor-handle-store';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';

interface DrawOnWhiteboardInput {
    whiteboardId?: string;
    mode?: 'append' | 'replace';
    elements?: WhiteboardDrawElement[];
}

const READINESS_TIMEOUT_MS = 6000;
const READINESS_POLL_MS = 120;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const readSnapshot = (): WhiteboardEditorHandleSnapshot =>
    useWhiteboardEditorHandleStore.getState().getSnapshot();

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
