const IMAGE_INSERTION_VIEWPORT_SCALE = 0.65;

export interface ImageDimensions {
    width: number;
    height: number;
};

const isFinitePositiveNumber = (value: number): boolean => Number.isFinite(value) && value > 0;

export const isSupportedWhiteboardImageFile = (file: File): boolean => file.type.startsWith('image/');

export const extractWhiteboardImageFiles = (files: ArrayLike<File> | Iterable<File> | null | undefined): File[] => {
    if (!files) {
        return [];
    }

    return Array.from(files).filter(isSupportedWhiteboardImageFile);
};

export const scaleImageDimensionsToViewport = (
    naturalDimensions: ImageDimensions,
    viewportDimensions: ImageDimensions
): ImageDimensions => {
    const safeNaturalWidth = isFinitePositiveNumber(naturalDimensions.width) ? naturalDimensions.width : 1;
    const safeNaturalHeight = isFinitePositiveNumber(naturalDimensions.height) ? naturalDimensions.height : 1;
    const safeViewportWidth = Math.max(1, viewportDimensions.width * IMAGE_INSERTION_VIEWPORT_SCALE);
    const safeViewportHeight = Math.max(1, viewportDimensions.height * IMAGE_INSERTION_VIEWPORT_SCALE);
    const scale = Math.min(
        1,
        safeViewportWidth / safeNaturalWidth,
        safeViewportHeight / safeNaturalHeight
    );

    return {
        width: Math.max(1, Math.round(safeNaturalWidth * scale)),
        height: Math.max(1, Math.round(safeNaturalHeight * scale))
    };
};
