import {
    CaptureUpdateAction,
    convertToExcalidrawElements,
    viewportCoordsToSceneCoords
} from '@excalidraw/excalidraw';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { FileId, OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { BinaryFileData, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import {
    extractWhiteboardImageFiles,
    scaleImageDimensionsToViewport
} from './whiteboard-image-files';
import type { ImageDimensions } from './whiteboard-image-files';

const IMAGE_INSERTION_STACK_OFFSET = 40;

export interface WhiteboardImageInsertionPoint {
    clientX: number;
    clientY: number;
};

export interface PreparedWhiteboardImageAsset extends BinaryFileData {
    id: FileId;
};

export interface InsertWhiteboardImagesOptions {
    api: ExcalidrawImperativeAPI;
    files: File[];
    prepareFile: (file: File) => Promise<PreparedWhiteboardImageAsset | null>;
    insertionPoint?: WhiteboardImageInsertionPoint | null;
};

const getViewportCenterInsertionPoint = (api: ExcalidrawImperativeAPI): WhiteboardImageInsertionPoint => {
    const appState = api.getAppState();

    return {
        clientX: appState.offsetLeft + (appState.width / 2),
        clientY: appState.offsetTop + (appState.height / 2)
    };
};

const resolveSceneInsertionPoint = (
    api: ExcalidrawImperativeAPI,
    insertionPoint?: WhiteboardImageInsertionPoint | null
) => {
    const appState = api.getAppState();
    const resolvedInsertionPoint = insertionPoint ?? getViewportCenterInsertionPoint(api);

    return viewportCoordsToSceneCoords(
        resolvedInsertionPoint,
        {
            zoom: appState.zoom,
            offsetLeft: appState.offsetLeft,
            offsetTop: appState.offsetTop,
            scrollX: appState.scrollX,
            scrollY: appState.scrollY
        }
    );
};

const loadImageDimensions = (file: File): Promise<ImageDimensions> =>
    new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);

            resolve({
                width: image.naturalWidth || image.width,
                height: image.naturalHeight || image.height
            });
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(`Failed to read image dimensions for ${file.name}`));
        };

        image.src = objectUrl;
    });

const buildImageSkeleton = (
    assetId: FileId,
    position: { x: number; y: number; },
    dimensions: ImageDimensions
): ExcalidrawElementSkeleton => ({
    type: 'image',
    x: position.x,
    y: position.y,
    width: dimensions.width,
    height: dimensions.height,
    fileId: assetId,
    status: 'saved',
    scale: [1, 1],
    crop: null
});

const toSelectedElementIds = (elements: OrderedExcalidrawElement[]): Record<string, true> => Object.fromEntries(
    elements.map((element) => [element.id, true])
);

export const insertWhiteboardImages = async ({
    api,
    files,
    prepareFile,
    insertionPoint
}: InsertWhiteboardImagesOptions): Promise<number> => {
    const imageFiles = extractWhiteboardImageFiles(files);
    if (imageFiles.length === 0) {
        return 0;
    }

    const appState = api.getAppState();
    const viewportDimensions = {
        width: appState.width / appState.zoom.value,
        height: appState.height / appState.zoom.value
    };
    const sceneInsertionPoint = resolveSceneInsertionPoint(api, insertionPoint);

    const preparedImages = await Promise.all(
        imageFiles.map(async (file, index) => {
            const [preparedFile, naturalDimensions] = await Promise.all([
                prepareFile(file),
                loadImageDimensions(file)
            ]);

            if (!preparedFile) {
                return null;
            }

            const dimensions = scaleImageDimensionsToViewport(naturalDimensions, viewportDimensions);
            const offset = IMAGE_INSERTION_STACK_OFFSET * index;
            const [imageElement] = convertToExcalidrawElements([
                buildImageSkeleton(
                    preparedFile.id,
                    {
                        x: sceneInsertionPoint.x - (dimensions.width / 2) + offset,
                        y: sceneInsertionPoint.y - (dimensions.height / 2) + offset
                    },
                    dimensions
                )
            ]);

            return {
                asset: preparedFile,
                element: imageElement
            };
        })
    );

    const successfulInsertions = preparedImages.filter((image): image is NonNullable<typeof image> => Boolean(image));
    if (successfulInsertions.length === 0) {
        return 0;
    }

    const nextElements = [
        ...api.getSceneElementsIncludingDeleted(),
        ...successfulInsertions.map((image) => image.element)
    ];

    api.addFiles(successfulInsertions.map((image) => image.asset));
    api.updateScene({
        elements: nextElements,
        appState: {
            ...appState,
            selectedElementIds: toSelectedElementIds(successfulInsertions.map((image) => image.element)),
            pendingImageElementId: null
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY
    });

    return successfulInsertions.length;
};
