import { insertWhiteboardImages } from '@/modules/whiteboards/utils/excalidraw-images';
import type { PreparedWhiteboardImageAsset } from '@/modules/whiteboards/utils/excalidraw-images';
import { extractWhiteboardImageFiles } from '@/modules/whiteboards/utils/whiteboard-image-files';
import { useCallback, useRef } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent, RefObject } from 'react';
import type { ExcalidrawAPI } from '@/modules/whiteboards/contracts/excalidraw';
import { sileo } from 'sileo';

interface UseWhiteboardImageInsertionProps {
    excalidrawApiRef: RefObject<ExcalidrawAPI | null>;
    prepareImageAsset: (file: File) => Promise<PreparedWhiteboardImageAsset | null>;
};

const EXCALIDRAW_CLIPBOARD_MIME_TYPES = [
    'application/vnd.excalidraw+json',
    'application/vnd.excalidrawlib+json'
];

const useWhiteboardImageInsertion = ({
    excalidrawApiRef,
    prepareImageAsset
}: UseWhiteboardImageInsertionProps) => {
    const imageFileInputRef = useRef<HTMLInputElement | null>(null);

    const insertImageFiles = useCallback(async (
        files: File[],
        insertionPoint?: { clientX: number; clientY: number; }
    ): Promise<number> => {
        const api = excalidrawApiRef.current;
        if (!api) {
            return 0;
        }

        try {
            return await insertWhiteboardImages({
                api,
                files,
                prepareFile: prepareImageAsset,
                insertionPoint
            });
        } catch {
            sileo.error({ title: 'Failed to insert image' });
            return 0;
        }
    }, [excalidrawApiRef, prepareImageAsset]);

    const handleOpenImagePicker = useCallback(() => {
        imageFileInputRef.current?.click();
    }, []);

    const handleImagePickerChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const imageFiles = extractWhiteboardImageFiles(event.currentTarget.files);
        event.currentTarget.value = '';

        if (imageFiles.length === 0) {
            return;
        }

        await insertImageFiles(imageFiles);
    }, [insertImageFiles]);

    const handleCanvasDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
        const imageFiles = extractWhiteboardImageFiles(event.dataTransfer?.files);
        if (imageFiles.length === 0) {
            return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    }, []);

    const handleCanvasDrop = useCallback(async (event: DragEvent<HTMLDivElement>) => {
        const imageFiles = extractWhiteboardImageFiles(event.dataTransfer?.files);
        if (imageFiles.length === 0) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        await insertImageFiles(imageFiles, {
            clientX: event.clientX,
            clientY: event.clientY
        });
    }, [insertImageFiles]);

    const handleCanvasPasteCapture = useCallback(async (event: ClipboardEvent<HTMLDivElement>) => {
        const clipboardTypes = new Set(Array.from(event.clipboardData?.types ?? []));
        if (EXCALIDRAW_CLIPBOARD_MIME_TYPES.some((mimeType) => clipboardTypes.has(mimeType))) {
            return;
        }

        const imageFiles = extractWhiteboardImageFiles(event.clipboardData?.files);
        if (imageFiles.length === 0) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        await insertImageFiles(imageFiles);
    }, [insertImageFiles]);

    return {
        imageFileInputRef,
        handleOpenImagePicker,
        handleImagePickerChange,
        handleCanvasDragOver,
        handleCanvasDrop,
        handleCanvasPasteCapture
    };
};

export default useWhiteboardImageInsertion;
