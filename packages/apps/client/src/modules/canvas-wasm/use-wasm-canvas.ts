import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isWasmLocalTrajectoryId } from './constants';
import { useWasmCanvasStore } from './store';
import { buildAtomRows, buildTrajectory } from './session';
import type { SceneObjectType } from '@/modules/fractal/contracts/scene';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { AtomData } from '@/modules/trajectory/api/services/trajectory-service';
import type { WasmFrameRecord } from './store';

const NO_LINES: string[] = [];
const NO_FRAMES: Record<number, WasmFrameRecord> = {};

export const useWasmTrajectory = (enabled: boolean): Trajectory | null => {
    const { trajectoryName, fileCount, totalSize, frames, analyses } = useWasmCanvasStore(useShallow((state) => ({
        trajectoryName: state.trajectoryName,
        fileCount: state.files.length,
        totalSize: state.totalSize,
        frames: state.frames,
        analyses: state.analyses
    })));
    return useMemo(() => (
        enabled && trajectoryName && frames.length > 0
            ? buildTrajectory(trajectoryName, { count: fileCount, totalSize }, frames, analyses)
            : null
    ), [analyses, enabled, fileCount, frames, totalSize, trajectoryName]);
};

// Keeps the default trajectory scene (the plain frame) built for the timestep on screen.
export const useWasmFrameSync = (enabled: boolean, timestep: number | undefined) => {
    const showFrame = useWasmCanvasStore((state) => state.showFrame);
    useEffect(() => {
        if (enabled && timestep !== undefined) showFrame(timestep);
    }, [enabled, showFrame, timestep]);
};

// Browser-built GLB for a scene of the local trajectory; null for any other trajectory. Scenes the cluster
// derives on request (color coding, particle filters) have no local build.
export const useWasmSceneGlb = (
    trajectoryId: string,
    timestep: number | undefined,
    scene: SceneObjectType
): { url: string | null; resourceKey: string | null } | null => {
    const isWasm = isWasmLocalTrajectoryId(trajectoryId);
    const url = useWasmCanvasStore((state) => {
        if (!isWasm || timestep === undefined) return null;
        if (scene.source === 'default') {
            return state.baseGlb?.timestep === timestep ? state.baseGlb.url : null;
        }
        if (scene.source === 'plugin') {
            return state.records[scene.analysisId]?.frames[timestep]?.scenes[scene.exposureId] ?? null;
        }
        return null;
    });
    return useMemo(() => (isWasm ? { url, resourceKey: url } : null), [isWasm, url]);
};

export const useWasmAtomRows = (enabled: boolean, analysisId: string | undefined, timestep: number | undefined): AtomData[] => {
    const frame = useWasmCanvasStore((state) => (
        enabled ? state.frames.find((candidate) => candidate.timestep === timestep) ?? state.frames[0] : undefined
    ));
    const atoms = useWasmCanvasStore((state) => (
        enabled && analysisId && timestep !== undefined ? state.records[analysisId]?.frames[timestep]?.atoms ?? null : null
    ));
    return useMemo(() => (frame ? buildAtomRows(frame, atoms) : []), [atoms, frame]);
};

export const useWasmFrameLog = (analysisId: string | undefined, timestep: number | undefined): string[] => (
    useWasmCanvasStore((state) => (
        analysisId && timestep !== undefined ? state.logs[analysisId]?.[timestep] ?? NO_LINES : NO_LINES
    ))
);

export const useWasmAnalysisFrames = (analysisId: string | undefined): Record<number, WasmFrameRecord> => (
    useWasmCanvasStore((state) => (analysisId ? state.records[analysisId]?.frames ?? NO_FRAMES : NO_FRAMES))
);
