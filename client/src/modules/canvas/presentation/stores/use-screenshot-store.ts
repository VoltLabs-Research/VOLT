import { create } from 'zustand';

export type ScreenshotFormat = 'png' | 'jpeg';
export type ScreenshotBackground = 'current' | 'transparent' | 'custom';

export interface ScreenshotResolutionPreset {
    label: string;
    width: number;
    height: number;
}

export const RESOLUTION_PRESETS: ScreenshotResolutionPreset[] = [
    { label: 'Viewport', width: 0, height: 0 },
    { label: 'HD (1920x1080)', width: 1920, height: 1080 },
    { label: 'QHD (2560x1440)', width: 2560, height: 1440 },
    { label: '4K (3840x2160)', width: 3840, height: 2160 },
    { label: 'Custom', width: 0, height: 0 }
];

export interface ScreenshotSettings {
    resolutionPreset: string;
    width: number;
    height: number;
    lockAspectRatio: boolean;
    background: ScreenshotBackground;
    customBackgroundColor: string;
    format: ScreenshotFormat;
    jpegQuality: number;
    supersamplingFactor: number;
}

interface ScreenshotState {
    settings: ScreenshotSettings;
    captureRequested: boolean;
    previewRequested: boolean;
    preview: string | null;
    isCapturing: boolean;
    viewportSize: { width: number; height: number };
}

interface ScreenshotActions {
    setSettings: (partial: Partial<ScreenshotSettings>) => void;
    requestCapture: () => void;
    clearCaptureRequest: () => void;
    requestPreview: () => void;
    clearPreviewRequest: () => void;
    setPreview: (dataUrl: string | null) => void;
    setIsCapturing: (value: boolean) => void;
    setViewportSize: (size: { width: number; height: number }) => void;
    reset: () => void;
}

const DEFAULT_SETTINGS: ScreenshotSettings = {
    resolutionPreset: 'Viewport',
    width: 0,
    height: 0,
    lockAspectRatio: true,
    background: 'current',
    customBackgroundColor: '#000000',
    format: 'png',
    jpegQuality: 0.92,
    supersamplingFactor: 1
};

export const useScreenshotStore = create<ScreenshotState & ScreenshotActions>((set) => ({
    settings: { ...DEFAULT_SETTINGS },
    captureRequested: false,
    previewRequested: false,
    preview: null,
    isCapturing: false,
    viewportSize: { width: 0, height: 0 },

    setSettings: (partial) => set((s) => ({
        settings: { ...s.settings, ...partial }
    })),

    requestCapture: () => set({ captureRequested: true }),
    clearCaptureRequest: () => set({ captureRequested: false }),
    requestPreview: () => set({ previewRequested: true }),
    clearPreviewRequest: () => set({ previewRequested: false }),
    setPreview: (dataUrl) => set({ preview: dataUrl }),
    setIsCapturing: (value) => set({ isCapturing: value }),
    setViewportSize: (size) => set({ viewportSize: size }),
    reset: () => set({ settings: { ...DEFAULT_SETTINGS }, preview: null, captureRequested: false, previewRequested: false, isCapturing: false })
}));
