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

const EXCALIDRAW_IMAGE_MIME_TYPES = new Set<PreparedWhiteboardImageAsset['mimeType']>([
    'image/svg+xml',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/x-icon',
    'image/avif',
    'image/jfif',
    'application/octet-stream'
]);

interface WhiteboardImageInsertionPoint {
    clientX: number;
    clientY: number;
};

export interface PreparedWhiteboardImageAsset extends BinaryFileData {
    id: FileId;
};

interface InsertWhiteboardImagesOptions {
    api: ExcalidrawImperativeAPI;
    files: File[];
    prepareFile: (file: File) => Promise<PreparedWhiteboardImageAsset | null>;
    insertionPoint?: WhiteboardImageInsertionPoint | null;
};

const blobToDataURL = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

const resolveExcalidrawImageMimeType = (mimeType: string): PreparedWhiteboardImageAsset['mimeType'] => {
    if (EXCALIDRAW_IMAGE_MIME_TYPES.has(mimeType as PreparedWhiteboardImageAsset['mimeType'])) {
        return mimeType as PreparedWhiteboardImageAsset['mimeType'];
    }

    return 'image/png';
};

export const dataURLToFile = (dataURL: string, fileName: string, mimeType: string): File => {
    const [header, payload = ''] = dataURL.split(',');
    const resolvedMime = header.match(/data:([^;,]+)/)?.[1] || mimeType || 'image/png';
    const binary = header.includes(';base64') ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return new File([bytes], fileName, { type: resolvedMime });
};

const isPreparedWhiteboardImageAsset = (value: unknown): value is PreparedWhiteboardImageAsset => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<PreparedWhiteboardImageAsset>;
    return typeof candidate.dataURL === 'string' && candidate.dataURL.startsWith('data:');
};

export const rematerializeWhiteboardImageFiles = async ({
    elements,
    files,
    ownedFileIds,
    prepareFile
}: {
    elements: Array<{ id: string; fileId?: string | null; [key: string]: unknown }>;
    files: Record<string, unknown>;
    ownedFileIds: Set<string>;
    prepareFile: (file: File) => Promise<PreparedWhiteboardImageAsset | null>;
}): Promise<{
    elements: Array<{ id: string; fileId?: string | null; [key: string]: unknown }>;
    files: Record<string, unknown>;
    assets: PreparedWhiteboardImageAsset[];
    changed: boolean;
}> => {
    const nextElements = [...elements];
    const nextFiles = { ...files };
    const assets: PreparedWhiteboardImageAsset[] = [];
    const rematerializedIds = new Map<string, PreparedWhiteboardImageAsset>();
    let changed = false;

    for (let index = 0; index < nextElements.length; index += 1) {
        const element = nextElements[index];
        const fileId = element.fileId;
        if (!fileId || ownedFileIds.has(fileId)) {
            continue;
        }

        let prepared = rematerializedIds.get(fileId);
        if (!prepared) {
            const source = nextFiles[fileId];
            if (!isPreparedWhiteboardImageAsset(source)) {
                continue;
            }

            const file = dataURLToFile(
                source.dataURL,
                `whiteboard-image-${fileId}`,
                source.mimeType || 'image/png'
            );
            const uploaded = await prepareFile(file);
            if (!uploaded) {
                continue;
            }

            prepared = uploaded;
            rematerializedIds.set(fileId, prepared);
            nextFiles[prepared.id] = prepared;
            delete nextFiles[fileId];
            assets.push(prepared);
        }

        nextElements[index] = {
            ...element,
            fileId: prepared.id,
            status: 'saved',
            version: Number(element.version ?? 0) + 1,
            versionNonce: Math.floor(Math.random() * 2 ** 31),
            updated: Date.now()
        };
        changed = true;
    }

    return {
        elements: nextElements,
        files: nextFiles,
        assets,
        changed
    };
};

export const createWhiteboardImageAsset = async (
    assetId: string,
    source: Blob
): Promise<PreparedWhiteboardImageAsset> => {
    const created = Date.now();

    return {
        id: assetId as FileId,
        mimeType: resolveExcalidrawImageMimeType(source.type),
        dataURL: await blobToDataURL(source) as PreparedWhiteboardImageAsset['dataURL'],
        created,
        lastRetrieved: created
    };
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
