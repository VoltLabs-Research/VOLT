export type ScreenshotResolutionPreset = 'viewport' | 'hd' | 'full-hd' | '4k' | 'custom';
export type ScreenshotAnglePreset = 'current' | 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'isometric';

export interface ScreenshotSettings {
    resolutionPreset: ScreenshotResolutionPreset;
    customWidth: number;
    customHeight: number;
    anglePreset: ScreenshotAnglePreset;
};

export interface ScreenshotRequest extends ScreenshotSettings {
    id: number;
}

export interface ScreenshotSize {
    width: number;
    height: number;
};

export const SCREENSHOT_RESOLUTION_PRESETS: Record<Exclude<ScreenshotResolutionPreset, 'viewport' | 'custom'>, ScreenshotSize> = {
    hd: { width: 1280, height: 720 },
    'full-hd': { width: 1920, height: 1080 },
    '4k': { width: 3840, height: 2160 }
};

export const SCREENSHOT_RESOLUTION_OPTIONS = [
    { value: 'viewport', title: 'Viewport' },
    { value: 'hd', title: 'HD · 1280 × 720' },
    { value: 'full-hd', title: 'Full HD · 1920 × 1080' },
    { value: '4k', title: '4K · 3840 × 2160' },
    { value: 'custom', title: 'Custom' }
] as const;

export const SCREENSHOT_ANGLE_OPTIONS = [
    { value: 'current', title: 'Current view' },
    { value: 'front', title: 'Front' },
    { value: 'back', title: 'Back' },
    { value: 'left', title: 'Left' },
    { value: 'right', title: 'Right' },
    { value: 'top', title: 'Top' },
    { value: 'bottom', title: 'Bottom' },
    { value: 'isometric', title: 'Isometric' }
] as const;

export const DEFAULT_SCREENSHOT_SETTINGS: ScreenshotSettings = {
    resolutionPreset: '4k',
    customWidth: 1920,
    customHeight: 1080,
    anglePreset: 'isometric'
};

const MIN_SCREENSHOT_DIMENSION = 64;
const MAX_SCREENSHOT_DIMENSION = 8192;

export const clampScreenshotDimension = (value: number, fallback: number): number => {
    if (!Number.isFinite(value)) {
        return fallback;
    }

    return Math.min(MAX_SCREENSHOT_DIMENSION, Math.max(MIN_SCREENSHOT_DIMENSION, Math.round(value)));
};

export const resolveScreenshotSize = (
    settings: ScreenshotSettings,
    viewportSize: ScreenshotSize,
    viewportScale = 1
): ScreenshotSize => {
    if (settings.resolutionPreset === 'viewport') {
        return {
            width: clampScreenshotDimension(viewportSize.width * viewportScale, viewportSize.width),
            height: clampScreenshotDimension(viewportSize.height * viewportScale, viewportSize.height)
        };
    }

    if (settings.resolutionPreset === 'custom') {
        return {
            width: clampScreenshotDimension(settings.customWidth, DEFAULT_SCREENSHOT_SETTINGS.customWidth),
            height: clampScreenshotDimension(settings.customHeight, DEFAULT_SCREENSHOT_SETTINGS.customHeight)
        };
    }

    return SCREENSHOT_RESOLUTION_PRESETS[settings.resolutionPreset];
};

export const resolveScreenshotScale = (
    baseSize: ScreenshotSize,
    outputSize: ScreenshotSize
): number => {
    if (baseSize.width <= 0 || baseSize.height <= 0) {
        return 1;
    }

    const areaScale = (outputSize.width * outputSize.height) / (baseSize.width * baseSize.height);
    if (!Number.isFinite(areaScale) || areaScale <= 0) {
        return 1;
    }

    return Math.sqrt(areaScale);
};
