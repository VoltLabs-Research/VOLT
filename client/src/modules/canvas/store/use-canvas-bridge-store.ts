import { create } from 'zustand';
import type { RefObject } from 'react';
import type { FractalSceneRef } from '@/modules/fractal/contracts/scene-ref';
import type { CanvasBridgeSnapshot } from '@/modules/ai/contracts/tools';

interface CanvasBridgeRegistration {
    trajectoryId: string | null;
    timesteps: number[];
    currentTimestep?: number;
    activeSceneId: string | null;
    sceneRef: RefObject<FractalSceneRef | null> | null;
}

interface CanvasBridgeState extends CanvasBridgeRegistration {
    mounted: boolean;
    
    aiActingUntil: number;
    register: (registration: CanvasBridgeRegistration) => void;
    unregister: () => void;
    markActing: (durationMs?: number) => void;
    getSnapshot: () => CanvasBridgeSnapshot;
}

const AI_ACTING_WINDOW_MS = 2200;

const EMPTY: CanvasBridgeRegistration = {
    trajectoryId: null,
    timesteps: [],
    currentTimestep: undefined,
    activeSceneId: null,
    sceneRef: null
};

export const useCanvasBridgeStore = create<CanvasBridgeState>((set, get) => ({
    ...EMPTY,
    mounted: false,
    aiActingUntil: 0,

    register(registration) {
        set({
            ...registration,
            mounted: true
        });
    },

    unregister() {
        set({
            ...EMPTY,
            mounted: false
        });
    },

    markActing(durationMs = AI_ACTING_WINDOW_MS) {
        set({ aiActingUntil: Date.now() + durationMs });
    },

    getSnapshot() {
        const state = get();
        const sceneApi = state.sceneRef?.current ?? null;

        return {
            mounted: state.mounted && Boolean(sceneApi || state.trajectoryId),
            trajectoryId: state.trajectoryId,
            timesteps: state.timesteps,
            currentTimestep: state.currentTimestep,
            activeSceneId: state.activeSceneId,
            resetCamera: sceneApi ? () => sceneApi.resetCamera() : null,
            zoomTo: sceneApi ? (zoomPercent: number) => sceneApi.zoomTo(zoomPercent) : null
        };
    }
}));
