import { create } from 'zustand';
import { useMemo } from 'react';
import { DEFAULT_CANVAS_ACCESS_STATE, type CanvasAccessState } from './types';
import { buildCanvasDataAccess, type CanvasDataAccess } from './build-canvas-data-access';

interface CanvasAccessStoreActions {
    setAccess: (state: Partial<CanvasAccessState>) => void;
    reset: () => void;
}

type CanvasAccessStore = CanvasAccessState & CanvasAccessStoreActions;

export const useCanvasAccessStore = create<CanvasAccessStore>((set) => ({
    ...DEFAULT_CANVAS_ACCESS_STATE,
    setAccess: (next) => set(next),
    reset: () => set({ ...DEFAULT_CANVAS_ACCESS_STATE })
}));

export const useCanvasAccessMode = () => useCanvasAccessStore((state) => state.mode);
export const useCanvasCanCollaborate = () => useCanvasAccessStore((state) => state.canCollaborate);

export const useCanvasDataAccess = (): CanvasDataAccess => {
    const mode = useCanvasAccessMode();
    return useMemo(() => buildCanvasDataAccess({ ...DEFAULT_CANVAS_ACCESS_STATE, mode }), [mode]);
};

export const withAccessMode = <TKey extends readonly unknown[]>(
    mode: CanvasAccessState['mode'],
    key: TKey
) => {
    return ['canvas-access', mode, ...key] as const;
};
