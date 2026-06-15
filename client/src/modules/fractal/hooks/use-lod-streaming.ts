import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { LODManager } from '@/modules/fractal/services/lod-manager';
import { fetchOctreeMetadata } from '@/modules/trajectory/utilities/octree-metadata-reader';
import { DEFAULT_LOD_SETTINGS } from '@/modules/fractal/types/lod-config';
import { debugFractal } from '@/modules/fractal/utilities/debug-log';

import type { LODSelection } from '@/modules/fractal/services/lod-manager';
import type { LODSettings, OctreeMetadata, TileFetchRequest } from '@/modules/fractal/types/lod-config';

interface UseLODStreamingParams {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number | undefined;
    camera: THREE.Camera | null;
    viewport: { width: number; height: number };
    settings?: LODSettings;
    // Called with a fetch request when selected cells carry per-cell GLB tiles
    // (forward slot — v1 single-GLB octrees never emit one). The fetcher hook
    // batches and resolves these; here we just surface them.
    onTileFetch?: (request: TileFetchRequest) => void;
}

interface UseLODStreamingResult {
    // The octree metadata once loaded; null while loading, or when none was baked
    // (small clouds) — in which case the Morton render path stays in charge.
    octree: OctreeMetadata | null;
    // Cells selected for the current camera; empty when LOD is disabled/unloaded.
    selection: LODSelection | null;
    manager: LODManager | null;
    // True only when LOD is enabled AND a sidecar was found — the engine should
    // honor `selection` only then; otherwise the existing full-GLB + Morton path
    // renders unchanged.
    active: boolean;
}

// React hook integrating the LOD manager with the fractal engine lifecycle.
// Gated behind `settings.enabled`: when off (the default), it fetches nothing,
// builds no manager, and returns active=false so the caller keeps the Morton
// decimation fallback. When on, it loads the octree sidecar for the exposure,
// builds a manager, and recomputes the visible tier set as the camera changes.
//
// Recomputation is driven by an explicit `recompute()` the render loop can call
// (e.g. on orbit-controls 'change'); the hook also recomputes when settings or
// the octree change. It deliberately does NOT subscribe to per-frame camera
// state in React — selection is computed imperatively to avoid re-render churn,
// matching the engine's imperative update pattern.
export const useLODStreaming = ({
    trajectoryId,
    analysisId,
    exposureId,
    timestep,
    camera,
    viewport,
    settings = DEFAULT_LOD_SETTINGS,
    onTileFetch
}: UseLODStreamingParams): UseLODStreamingResult & { recompute: () => void } => {
    const [octree, setOctree] = useState<OctreeMetadata | null>(null);
    const [selection, setSelection] = useState<LODSelection | null>(null);
    const managerRef = useRef<LODManager | null>(null);

    // Latest viewport/settings without re-running the manager-build effect on
    // every dimension or settings tweak — selection is recomputed imperatively.
    const viewportRef = useRef(viewport);
    viewportRef.current = viewport;
    const settingsRef = useRef(settings);
    settingsRef.current = settings;

    const enabled = settings.enabled
        && !!trajectoryId
        && !!analysisId
        && !!exposureId
        && timestep !== undefined;

    // Load the octree sidecar when enabled. A null result (no bake) leaves the
    // manager unbuilt → active=false → Morton fallback.
    useEffect(() => {
        if (!enabled) {
            setOctree(null);
            return;
        }
        let cancelled = false;
        fetchOctreeMetadata({ trajectoryId, analysisId, exposureId, timestep: timestep! })
            .then((metadata) => {
                if (cancelled) return;
                setOctree(metadata);
                debugFractal('lod.octree-loaded', {
                    trajectoryId,
                    analysisId,
                    exposureId,
                    timestep,
                    cells: metadata?.cells.length ?? 0,
                    maxDepth: metadata?.maxDepth ?? 0
                });
            })
            .catch(() => {
                if (!cancelled) setOctree(null);
            });
        return () => {
            cancelled = true;
        };
    }, [enabled, trajectoryId, analysisId, exposureId, timestep]);

    // (Re)build the manager when the octree, camera, or enabled flag changes.
    // Viewport/settings come from refs so a resize or settings tweak does not
    // rebuild the manager — those flow through setViewport / recompute instead.
    useEffect(() => {
        if (!octree || !camera || !enabled) {
            managerRef.current = null;
            setSelection(null);
            return;
        }
        managerRef.current = new LODManager(octree, viewportRef.current, camera);
        // Compute an initial selection immediately so the first frame is gated.
        setSelection(managerRef.current.selectLODTiles(settingsRef.current));
    }, [octree, camera, enabled]);

    // Keep the manager's camera fresh without rebuilding it.
    useEffect(() => {
        const manager = managerRef.current;
        if (!manager || !camera) return;
        manager.setCamera(camera);
    }, [camera]);

    // Push viewport changes (resize) to the existing manager without a rebuild.
    useEffect(() => {
        managerRef.current?.setViewport(viewport);
    }, [viewport]);

    const recompute = useCallback(() => {
        const manager = managerRef.current;
        if (!manager) return;
        manager.setViewport(viewportRef.current);
        const next = manager.selectLODTiles(settingsRef.current);
        setSelection(next);
        if (onTileFetch) {
            const request = manager.requestTiles(analysisId, next);
            if (request) onTileFetch(request);
        }
    }, [analysisId, onTileFetch]);

    // Recompute when settings or the octree change (strategy/level/target affect
    // selection). `settings` is read through the ref inside recompute; listing it
    // here is what triggers the recompute on a settings edit.
    useEffect(() => {
        recompute();
    }, [recompute, octree, settings]);

    return {
        octree,
        selection,
        manager: managerRef.current,
        active: enabled && octree !== null,
        recompute
    };
};
