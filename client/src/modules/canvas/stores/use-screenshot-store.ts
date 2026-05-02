import { create } from 'zustand';
import { DEFAULT_SCREENSHOT_SETTINGS } from '../utilities/screenshot';

import type { ScreenshotRequest, ScreenshotSettings } from '../utilities/screenshot';

interface ScreenshotState {
    pendingRequest: ScreenshotRequest | null;
    lastUsedSettings: ScreenshotSettings;
    isCapturing: boolean;
    nextRequestId: number;
}

interface ScreenshotActions {
    requestCapture: (settings?: Partial<ScreenshotSettings>) => void;
    clearPendingRequest: () => void;
    setIsCapturing: (isCapturing: boolean) => void;
    reset: () => void;
}

const initialState: ScreenshotState = {
    pendingRequest: null,
    lastUsedSettings: DEFAULT_SCREENSHOT_SETTINGS,
    isCapturing: false,
    nextRequestId: 1
};

export const useScreenshotStore = create<ScreenshotState & ScreenshotActions>((set, get) => ({
    ...initialState,
    requestCapture: (settings) => {
        if (get().isCapturing) {
            return;
        }

        const nextSettings = {
            ...get().lastUsedSettings,
            ...settings
        };

        set((state) => ({
            lastUsedSettings: nextSettings,
            pendingRequest: {
                ...nextSettings,
                id: state.nextRequestId
            },
            nextRequestId: state.nextRequestId + 1
        }));
    },
    clearPendingRequest: () => set({ pendingRequest: null }),
    setIsCapturing: (isCapturing) => set({ isCapturing }),
    reset: () => set(initialState)
}));
