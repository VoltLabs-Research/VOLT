import { CaptureUpdateAction, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { ExcalidrawElement, OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type {
    WhiteboardDrawElement,
    WhiteboardDrawRequest,
    WhiteboardDrawResult
} from '@/modules/whiteboards/stores/use-whiteboard-editor-handle-store';

const DEFAULT_SHAPE_SIZE = 120;

const toSelectedElementIds = (elements: readonly { id: string }[]): Record<string, true> =>
    Object.fromEntries(elements.map((element) => [element.id, true]));

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
