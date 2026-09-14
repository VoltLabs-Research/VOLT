import { create } from 'zustand';
import { DEFAULT_SCREENSHOT_SETTINGS } from '../utils/screenshot';

import type { ScreenshotRequest, ScreenshotSettings } from '../utils/screenshot';

export interface FigureBatchProgress {
    current: number;
    total: number;
    label: string;
}

interface ScreenshotState {
    pendingRequest: ScreenshotRequest | null;
    lastUsedSettings: ScreenshotSettings;
    isCapturing: boolean;
    isFigureBatchActive: boolean;
    figureBatchProgress: FigureBatchProgress | null;
    selectedFigureAnalysisIds: string[];
    nextRequestId: number;
}

interface RequestCaptureOptions {
    filename?: string;
    fromBatch?: boolean;
    silent?: boolean;
}

interface ScreenshotActions {
    requestCapture: (settings?: Partial<ScreenshotSettings>, options?: RequestCaptureOptions) => number | null;
    setFilenameResolver: (resolver: (() => string) | null) => void;
    clearPendingRequest: () => void;
    setIsCapturing: (isCapturing: boolean) => void;
    setFigureBatchActive: (isFigureBatchActive: boolean) => void;
    setFigureBatchProgress: (progress: FigureBatchProgress | null) => void;
    setSelectedFigureAnalysisIds: (analysisIds: string[]) => void;
    notifyCaptureSettled: (requestId: number, error?: Error) => void;
    waitForCapture: (requestId: number) => Promise<void>;
    reset: () => void;
}

const initialState: ScreenshotState = {
    pendingRequest: null,
    lastUsedSettings: DEFAULT_SCREENSHOT_SETTINGS,
    isCapturing: false,
    isFigureBatchActive: false,
    figureBatchProgress: null,
    selectedFigureAnalysisIds: [],
    nextRequestId: 1
};

type CaptureWaiter = {
    resolve: () => void;
    reject: (error: Error) => void;
};

export const useScreenshotStore = create<ScreenshotState & ScreenshotActions>((set, get) => {
    const waiters = new Map<number, CaptureWaiter>();
    const settled = new Map<number, Error | null>();
    const queued: ScreenshotRequest[] = [];
    let filenameResolver: (() => string) | null = null;

    const dequeueNext = () => {
        if (get().isCapturing || get().pendingRequest || queued.length === 0) {
            return;
        }

        const next = queued.shift();
        if (!next) {
            return;
        }

        set({ pendingRequest: next });
    };

    const settleWaiter = (requestId: number, error?: Error) => {
        const waiter = waiters.get(requestId);
        if (!waiter) {
            settled.set(requestId, error ?? null);
            return;
        }

        waiters.delete(requestId);
        if (error) {
            waiter.reject(error);
            return;
        }

        waiter.resolve();
    };

    return {
        ...initialState,
        requestCapture: (settings, options) => {
            if (get().isFigureBatchActive && !options?.fromBatch) {
                return null;
            }

            const nextSettings = {
                ...get().lastUsedSettings,
                ...settings
            };
            const filename = options?.filename ?? filenameResolver?.();
            const request: ScreenshotRequest = {
                ...nextSettings,
                id: get().nextRequestId,
                ...(filename ? { filename } : {}),
                ...(options?.silent || options?.fromBatch ? { silent: true } : {})
            };

            set({
                lastUsedSettings: nextSettings,
                nextRequestId: request.id + 1
            });

            if (get().isCapturing || get().pendingRequest) {
                queued.push(request);
                return request.id;
            }

            set({ pendingRequest: request });
            return request.id;
        },
        setFilenameResolver: (resolver) => {
            filenameResolver = resolver;
        },
        clearPendingRequest: () => set({ pendingRequest: null }),
        setIsCapturing: (isCapturing) => {
            set({ isCapturing });
            if (!isCapturing) {
                dequeueNext();
            }
        },
        setFigureBatchActive: (isFigureBatchActive) => set({
            isFigureBatchActive,
            ...(isFigureBatchActive ? {} : { figureBatchProgress: null })
        }),
        setFigureBatchProgress: (figureBatchProgress) => set({ figureBatchProgress }),
        setSelectedFigureAnalysisIds: (selectedFigureAnalysisIds) => set({ selectedFigureAnalysisIds }),
        notifyCaptureSettled: (requestId, error) => {
            settleWaiter(requestId, error);
            dequeueNext();
        },
        waitForCapture: (requestId) => {
            if (settled.has(requestId)) {
                const error = settled.get(requestId);
                settled.delete(requestId);
                return error ? Promise.reject(error) : Promise.resolve();
            }

            return new Promise<void>((resolve, reject) => {
                waiters.set(requestId, { resolve, reject });
            });
        },
        reset: () => {
            queued.length = 0;
            settled.clear();
            waiters.forEach((waiter) => {
                waiter.reject(new Error('Screenshot store reset.'));
            });
            waiters.clear();
            filenameResolver = null;
            set(initialState);
        }
    };
});
