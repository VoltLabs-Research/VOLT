import { create } from 'zustand';

interface ScreenshotState {
    captureRequested: boolean;
}

interface ScreenshotActions {
    requestCapture: () => void;
    clearCaptureRequest: () => void;
}

export const useScreenshotStore = create<ScreenshotState & ScreenshotActions>((set) => ({
    captureRequested: false,
    requestCapture: () => set({ captureRequested: true }),
    clearCaptureRequest: () => set({ captureRequested: false })
}));
