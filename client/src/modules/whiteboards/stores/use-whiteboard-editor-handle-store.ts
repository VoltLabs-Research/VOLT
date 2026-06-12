import { create } from 'zustand';

/**
 * Whiteboard editor handle — the bridge between AI client tools and the LIVE
 * Excalidraw editor.
 *
 * The imperative Excalidraw API lives in `WhiteboardEditorPage` component scope
 * (an `excalidrawApiRef`), and the skeleton→element conversion that drives a
 * draw can only run in the browser (and must stay in the whiteboard route chunk
 * so `@excalidraw/excalidraw` is never pulled into the eagerly-globbed AI tool
 * registry). So the page registers a `draw` callback (and an `isReady` probe)
 * here on mount and clears them on unmount; the `draw_on_whiteboard` client tool
 * reads this store via `getState()` and fails gracefully when no board is open.
 *
 * Deliberately a PLAIN zustand store holding non-serializable callbacks and
 * ephemeral mount state — it must contain NO Excalidraw imports (the handler and
 * the AI registry transitively import it).
 */

export type WhiteboardDrawElementKind =
    | 'rectangle'
    | 'ellipse'
    | 'diamond'
    | 'text'
    | 'arrow'
    | 'line';

/**
 * A high-level element the model authors. Intentionally Excalidraw-agnostic
 * (plain data) — `whiteboard-draw.ts` maps it to an Excalidraw skeleton.
 */
export interface WhiteboardDrawElement {
    kind: WhiteboardDrawElementKind;
    x: number;
    y: number;
    width?: number;
    height?: number;
    /** Label for a shape/arrow, or the content of a `text` element. */
    text?: string;
    /** Explicit geometry for `arrow`/`line` (relative to x,y). */
    points?: [number, number][];
    /** Bind an arrow's tail to another element by its `id`. */
    start?: { id: string };
    /** Bind an arrow's head to another element by its `id`. */
    end?: { id: string };
    /** Stable id so arrows can reference this element via start/end. */
    id?: string;
    strokeColor?: string;
    backgroundColor?: string;
    fontSize?: number;
}

export interface WhiteboardDrawRequest {
    mode: 'append' | 'replace';
    elements: WhiteboardDrawElement[];
}

export interface WhiteboardDrawResult {
    drawn: number;
}

export interface WhiteboardEditorHandleSnapshot {
    /** Whether the editor page is mounted (the board route is active). */
    mounted: boolean;
    /** The whiteboard currently open in the editor, if any. */
    whiteboardId: string | null;
    /** True only when the editor is mounted AND the Excalidraw API is live. */
    ready: boolean;
    /** Imperative draw handle — non-null only when `ready`. */
    draw: ((request: WhiteboardDrawRequest) => WhiteboardDrawResult) | null;
}

interface WhiteboardEditorHandleRegistration {
    whiteboardId: string;
    /** Reports whether the Excalidraw API has finished loading (lazy chunk). */
    isReady: () => boolean;
    draw: (request: WhiteboardDrawRequest) => WhiteboardDrawResult;
}

interface WhiteboardEditorHandleState {
    whiteboardId: string | null;
    isReady: (() => boolean) | null;
    draw: ((request: WhiteboardDrawRequest) => WhiteboardDrawResult) | null;
    mounted: boolean;
    register: (registration: WhiteboardEditorHandleRegistration) => void;
    unregister: () => void;
    getSnapshot: () => WhiteboardEditorHandleSnapshot;
}

const EMPTY: Pick<WhiteboardEditorHandleState, 'whiteboardId' | 'isReady' | 'draw'> = {
    whiteboardId: null,
    isReady: null,
    draw: null
};

export const useWhiteboardEditorHandleStore = create<WhiteboardEditorHandleState>((set, get) => ({
    ...EMPTY,
    mounted: false,

    register(registration) {
        set({ ...registration, mounted: true });
    },

    unregister() {
        set({ ...EMPTY, mounted: false });
    },

    getSnapshot() {
        const state = get();
        const ready = state.mounted && Boolean(state.draw) && (state.isReady?.() ?? false);

        return {
            mounted: state.mounted,
            whiteboardId: state.whiteboardId,
            ready,
            draw: ready ? state.draw : null
        };
    }
}));
