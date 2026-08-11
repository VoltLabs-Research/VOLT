import { getBoxCorners, getFallbackBoxFromModelWorldBounds } from '@/modules/fractal/utils/camera-framing';

import type { ModelWorldBounds } from '@/modules/fractal/contracts/model';
import type { OrthographicCamera, PerspectiveCamera } from 'three';

interface PixelCropRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

const SCREENSHOT_CROP_MIN_DIMENSION = 4;
const SCREENSHOT_CROP_PIXEL_PADDING = 2;

const canvasToBlob = (canvas: HTMLCanvasElement) => {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Canvas capture returned an empty blob.'));
                return;
            }

            resolve(blob);
        }, 'image/png');
    });
};

const getPixelCropRectFromWorldBounds = (
    worldBounds: ModelWorldBounds,
    camera: PerspectiveCamera | OrthographicCamera,
    canvasWidth: number,
    canvasHeight: number
): PixelCropRect | null => {
    const box = getFallbackBoxFromModelWorldBounds(worldBounds);
    if (!box || box.isEmpty() || canvasWidth <= 0 || canvasHeight <= 0) {
        return null;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let hasProjectedPoint = false;

    getBoxCorners(box).forEach((corner) => {
        const projected = corner.clone().project(camera);

        if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) {
            return;
        }

        const x = ((projected.x + 1) * 0.5) * canvasWidth;
        const y = ((1 - projected.y) * 0.5) * canvasHeight;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        hasProjectedPoint = true;
    });

    if (!hasProjectedPoint) {
        return null;
    }

    const left = Math.max(0, Math.floor(minX) - SCREENSHOT_CROP_PIXEL_PADDING);
    const top = Math.max(0, Math.floor(minY) - SCREENSHOT_CROP_PIXEL_PADDING);
    const right = Math.min(canvasWidth, Math.ceil(maxX) + SCREENSHOT_CROP_PIXEL_PADDING);
    const bottom = Math.min(canvasHeight, Math.ceil(maxY) + SCREENSHOT_CROP_PIXEL_PADDING);
    const width = right - left;
    const height = bottom - top;

    if (width < SCREENSHOT_CROP_MIN_DIMENSION || height < SCREENSHOT_CROP_MIN_DIMENSION) {
        return null;
    }

    return {
        x: left,
        y: top,
        width,
        height
    };
};

const cropCanvasToRect = (sourceCanvas: HTMLCanvasElement, cropRect: PixelCropRect) => {
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = cropRect.width;
    outputCanvas.height = cropRect.height;

    const context = outputCanvas.getContext('2d');
    if (!context) {
        throw new Error('Could not create a 2D context for screenshot cropping.');
    }

    context.drawImage(
        sourceCanvas,
        cropRect.x,
        cropRect.y,
        cropRect.width,
        cropRect.height,
        0,
        0,
        cropRect.width,
        cropRect.height
    );

    return outputCanvas;
};

export const encodeCanvasToPngBlob = (
    canvas: HTMLCanvasElement,
    camera: PerspectiveCamera | OrthographicCamera,
    cropBoundsWorld?: ModelWorldBounds | null
): Promise<Blob> => {
    const cropRect = cropBoundsWorld
        ? getPixelCropRectFromWorldBounds(cropBoundsWorld, camera, canvas.width, canvas.height)
        : null;

    return canvasToBlob(cropRect ? cropCanvasToRect(canvas, cropRect) : canvas);
};
