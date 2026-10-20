import { create } from 'zustand';

type WhiteboardDrawElementKind =
    | 'rectangle'
    | 'ellipse'
    | 'diamond'
    | 'text'
    | 'arrow'
    | 'line';

export interface WhiteboardDrawElement {
    kind: WhiteboardDrawElementKind;
    x: number;
    y: number;
    width?: number;
    height?: number;
    text?: string;
    points?: [number, number][];
    start?: { id: string };
    end?: { id: string };
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
    whiteboardId: string | null;
    ready: boolean;
    draw: ((request: WhiteboardDrawRequest) => WhiteboardDrawResult) | null;
}

interface WhiteboardEditorHandleRegistration {
    whiteboardId: string;
    isReady: () => boolean;
    draw: (request: WhiteboardDrawRequest) => WhiteboardDrawResult;
}

interface WhiteboardEditorHandleState {
    whiteboardId: string | null;
    isReady: (() => boolean) | null;
    draw: ((request: WhiteboardDrawRequest) => WhiteboardDrawResult) | null;
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

    register(registration) {
        set(registration);
    },

    unregister() {
        set(EMPTY);
    },

    getSnapshot() {
        const state = get();
        const ready = state.isReady?.() ?? false;

        return {
            whiteboardId: state.whiteboardId,
            ready,
            draw: ready ? state.draw : null
        };
    }
}));
