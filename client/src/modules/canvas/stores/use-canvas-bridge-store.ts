import { create } from 'zustand';
import type { RefObject } from 'react';
import type { FractalSceneRef } from '@/modules/fractal/components/organisms/FractalScene';
import type { CanvasBridgeSnapshot } from '@/modules/ai/tools/types';

/**
 * Canvas bridge — the link between AI client tools and the LIVE 3D viewer.
 *
 * The active `trajectoryId`, the available `timesteps`, and the imperative
 * `FractalSceneRef` live in CanvasPage component scope, not in the editor
 * store. AI viewer tools (control_playback, seek_frame, reset_camera, …) need
 * to reach them, so CanvasPage registers them here on mount and clears them on
 * unmount. Handlers read `getSnapshot()` and fail gracefully when the viewer
 * is not mounted.
 *
 * Deliberately a PLAIN zustand store (NOT the zundo `temporal()` editor store):
 * it holds a non-serializable React ref and ephemeral mount state that must
 * never enter undo/redo history or persistence.
 */

interface CanvasBridgeRegistration {
    trajectoryId: string | null;
    timesteps: number[];
    currentTimestep?: number;
    activeSceneId: string | null;
    sceneRef: RefObject<FractalSceneRef | null> | null;
}

interface CanvasBridgeState extends CanvasBridgeRegistration {
    mounted: boolean;
    /** Timestamp (ms) until which the viewer should show the "AI is adjusting the view" badge. */
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
        set({ ...registration, mounted: true });
    },

    unregister() {
        set({ ...EMPTY, mounted: false });
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
