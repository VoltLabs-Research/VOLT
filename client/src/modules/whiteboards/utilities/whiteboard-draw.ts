import { CaptureUpdateAction, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { ExcalidrawElement, OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type {
    WhiteboardDrawElement,
    WhiteboardDrawRequest,
    WhiteboardDrawResult
} from '@/modules/whiteboards/stores/use-whiteboard-editor-handle-store';

/**
 * Turns the model's high-level element list into real Excalidraw elements and
 * applies them to the LIVE editor scene. This is the ONLY whiteboard-AI module
 * that imports `@excalidraw/excalidraw`; it is registered by the (lazily-loaded)
 * editor page so the heavy package stays out of the eagerly-globbed AI tool
 * registry. The matching client tool handler (`handlers/draw_on_whiteboard.ts`)
 * is pure and reaches this through the editor-handle store.
 *
 * Mirrors `insertWhiteboardImages`: convert skeletons → elements, merge with the
 * existing scene (append) or replace it, then `updateScene`. The page's
 * `onChange` → `sendDelta` then propagates the edit to collaborators exactly
 * like a human's — no special-casing, and we deliberately do NOT arm the
 * remote-echo suppression so AI edits broadcast.
 */

const DEFAULT_SHAPE_SIZE = 120;

const toSelectedElementIds = (elements: readonly { id: string }[]): Record<string, true> =>
    Object.fromEntries(elements.map((element) => [element.id, true]));

/** Maps one high-level element to an Excalidraw skeleton. */
const toSkeleton = (element: WhiteboardDrawElement): ExcalidrawElementSkeleton => {
    const base = {
        id: element.id,
        x: element.x,
        y: element.y,
        strokeColor: element.strokeColor,
        backgroundColor: element.backgroundColor
    };

    if (element.kind === 'text') {
        return {
            ...base,
            type: 'text',
            text: element.text ?? '',
            fontSize: element.fontSize
        } as ExcalidrawElementSkeleton;
    }

    if (element.kind === 'arrow' || element.kind === 'line') {
        return {
            ...base,
            type: element.kind,
            width: element.width,
            height: element.height,
            points: element.points,
            start: element.start,
            end: element.end,
            label: element.text ? { text: element.text } : undefined
        } as ExcalidrawElementSkeleton;
    }

    // rectangle | ellipse | diamond
    return {
        ...base,
        type: element.kind,
        width: element.width ?? DEFAULT_SHAPE_SIZE,
        height: element.height ?? DEFAULT_SHAPE_SIZE,
        label: element.text ? { text: element.text } : undefined
    } as ExcalidrawElementSkeleton;
};

export const applyWhiteboardDrawRequest = (
    api: ExcalidrawImperativeAPI,
    request: WhiteboardDrawRequest
): WhiteboardDrawResult => {
    const skeletons = request.elements.map(toSkeleton);

    // Default opts regenerate scene ids (avoids collisions in append mode) while
    // still resolving arrow start/end bindings against the skeletons' own ids.
    const newElements = convertToExcalidrawElements(skeletons) as OrderedExcalidrawElement[];

    if (newElements.length === 0) {
        return { drawn: 0 };
    }

    const appState = api.getAppState();
    const existing: readonly OrderedExcalidrawElement[] = request.mode === 'replace'
        ? []
        : api.getSceneElementsIncludingDeleted();

    api.updateScene({
        elements: [...existing, ...newElements] as unknown as readonly ExcalidrawElement[],
        appState: {
            ...appState,
            selectedElementIds: toSelectedElementIds(newElements)
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY
    });

    return { drawn: newElements.length };
};
