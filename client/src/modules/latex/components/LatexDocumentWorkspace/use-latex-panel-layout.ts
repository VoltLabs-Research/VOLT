import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

export type LatexPanelKey = 'files' | 'preview' | 'ai' | 'editor';

export interface PanelWidths {
    files: number;
    preview: number;
    ai: number;
    editorTop: number;
}

interface PanelDescriptor {
    widthKey: keyof PanelWidths;
    /** Axis the pointer travels along while resizing. */
    axis: 'x' | 'y';
    /** 1 when moving towards larger coordinates grows the panel, -1 when it shrinks it. */
    sign: 1 | -1;
    min: number;
    /** null when the ceiling can only be measured from the editor stack. */
    max: number | null;
    label: string;
    controls?: string;
    className: string;
}

const STORAGE_KEY = 'volt:latex-panel-widths';
const KEYBOARD_STEP = 24;
const EDITOR_GROUP_GAP = 8;

export const PANEL_DESCRIPTORS: Record<LatexPanelKey, PanelDescriptor> = {
    files: {
        widthKey: 'files',
        axis: 'x',
        sign: 1,
        min: 160,
        max: 400,
        label: 'Resize file panel',
        controls: 'latex-file-panel',
        className: 'latex-drag-handle'
    },
    preview: {
        widthKey: 'preview',
        axis: 'x',
        sign: -1,
        min: 260,
        max: 600,
        label: 'Resize preview panel',
        controls: 'latex-preview-panel',
        className: 'latex-drag-handle'
    },
    ai: {
        widthKey: 'ai',
        axis: 'y',
        sign: -1,
        min: 100,
        max: 600,
        label: 'Resize AI panel',
        controls: 'latex-ai-panel',
        className: 'latex-drag-handle-horizontal'
    },
    editor: {
        widthKey: 'editorTop',
        axis: 'y',
        sign: 1,
        min: 180,
        max: null,
        label: 'Resize editor groups',
        className: 'latex-drag-handle-horizontal latex-workspace__editor-split-handle'
    }
};

const DEFAULT_WIDTHS: PanelWidths = {
    files: 220,
    preview: PANEL_DESCRIPTORS.preview.max ?? 600,
    ai: 300,
    editorTop: 260
};

const clampToLimits = (descriptor: PanelDescriptor, value: number): number => {
    return Math.min(descriptor.max ?? Infinity, Math.max(descriptor.min, value));
};

/**
 * Widths survive reloads, so they come back from storage stale whenever the
 * limits below change: clamp on read instead of trusting them.
*/
const loadPanelWidths = (): PanelWidths => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return DEFAULT_WIDTHS;

        const parsed = JSON.parse(saved) as Partial<PanelWidths>;
        const widths = { ...DEFAULT_WIDTHS };

        for (const descriptor of Object.values(PANEL_DESCRIPTORS)) {
            const { widthKey } = descriptor;
            widths[widthKey] = clampToLimits(descriptor, parsed[widthKey] ?? DEFAULT_WIDTHS[widthKey]);
        }

        return widths;
    } catch {
        return DEFAULT_WIDTHS;
    }
};

interface DragState {
    descriptor: PanelDescriptor;
    startX: number;
    startY: number;
    startSize: number;
}

interface UseLatexPanelLayoutInput {
    isEditorSplit: boolean;
}

/**
 * Sizing of the four resizable workspace panels: pointer drags, keyboard
 * nudges, persistence and the editor split ceiling.
*/
const useLatexPanelLayout = ({ isEditorSplit }: UseLatexPanelLayoutInput) => {
    const [panelWidths, setPanelWidths] = useState<PanelWidths>(loadPanelWidths);
    const dragStateRef = useRef<DragState | null>(null);
    const editorStackRef = useRef<HTMLDivElement | null>(null);

    const resolveMaxSize = useCallback((descriptor: PanelDescriptor): number => {
        if (descriptor.max !== null) {
            return descriptor.max;
        }

        const hostHeight = editorStackRef.current?.getBoundingClientRect().height ?? 0;
        return Math.max(descriptor.min, hostHeight - descriptor.min - EDITOR_GROUP_GAP);
    }, []);

    const clampToHost = useCallback((descriptor: PanelDescriptor, value: number): number => {
        return Math.min(resolveMaxSize(descriptor), Math.max(descriptor.min, value));
    }, [resolveMaxSize]);

    const persistWidths = (widths: PanelWidths): PanelWidths => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
        return widths;
    };

    const onPointerDown = (panel: LatexPanelKey, event: PointerEvent<HTMLDivElement>): void => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const descriptor = PANEL_DESCRIPTORS[panel];
        dragStateRef.current = {
            descriptor,
            startX: event.clientX,
            startY: event.clientY,
            startSize: panelWidths[descriptor.widthKey]
        };
    };

    const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
        const state = dragStateRef.current;
        if (!state || !event.currentTarget.hasPointerCapture(event.pointerId)) return;

        const { descriptor } = state;
        const travelled = descriptor.axis === 'x'
            ? event.clientX - state.startX
            : event.clientY - state.startY;

        setPanelWidths((current) => ({
            ...current,
            [descriptor.widthKey]: clampToHost(descriptor, state.startSize + descriptor.sign * travelled)
        }));
    };

    const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
        if (!dragStateRef.current) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        dragStateRef.current = null;
        setPanelWidths(persistWidths);
    };

    const onPointerCancel = (): void => {
        dragStateRef.current = null;
    };

    const onKeyDown = (panel: LatexPanelKey, event: KeyboardEvent<HTMLDivElement>): void => {
        const isIncrease = event.key === 'ArrowRight' || event.key === 'ArrowDown';
        const isDecrease = event.key === 'ArrowLeft' || event.key === 'ArrowUp';

        if (!isIncrease && !isDecrease) {
            return;
        }

        event.preventDefault();
        const descriptor = PANEL_DESCRIPTORS[panel];
        const delta = (isIncrease ? 1 : -1) * descriptor.sign * KEYBOARD_STEP;

        setPanelWidths((current) => persistWidths({
            ...current,
            [descriptor.widthKey]: clampToHost(descriptor, current[descriptor.widthKey] + delta)
        }));
    };

    useEffect(() => {
        const host = editorStackRef.current;
        if (!isEditorSplit || !host) {
            return;
        }

        const clampEditorSplit = (): void => {
            setPanelWidths((current) => {
                const editorTop = clampToHost(PANEL_DESCRIPTORS.editor, current.editorTop);
                return editorTop === current.editorTop
                    ? current
                    : {
                        ...current,
                        editorTop
                    };
            });
        };

        clampEditorSplit();

        const observer = new ResizeObserver(clampEditorSplit);
        observer.observe(host);
        return () => observer.disconnect();
    }, [clampToHost, isEditorSplit]);

    return {
        panelWidths,
        editorStackRef,
        resize: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel,
            onKeyDown
        }
    };
};

export default useLatexPanelLayout;

export type PanelLayout = ReturnType<typeof useLatexPanelLayout>;
