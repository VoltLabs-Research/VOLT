import { create } from 'zustand';

interface ScreenshotState {
    captureRequested: boolean;
};

interface ScreenshotActions {
    requestCapture: () => void;
    clearCaptureRequest: () => void;
    reset: () => void;
};

const initialState: ScreenshotState = {
    captureRequested: false
};

export const useScreenshotStore = create<ScreenshotState & ScreenshotActions>((set) => ({
    ...initialState,
    requestCapture: () => set({ captureRequested: true }),
    clearCaptureRequest: () => set({ captureRequested: false }),
    reset: () => set(initialState)
}));
