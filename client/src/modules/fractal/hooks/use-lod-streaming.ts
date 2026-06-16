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
    onTileFetch?: (request: TileFetchRequest) => void;
}

interface UseLODStreamingResult {
    octree: OctreeMetadata | null;
    selection: LODSelection | null;
    manager: LODManager | null;
    active: boolean;
}

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

    const viewportRef = useRef(viewport);
    viewportRef.current = viewport;
    const settingsRef = useRef(settings);
    settingsRef.current = settings;

    const enabled = settings.enabled
        && !!trajectoryId
        && !!analysisId
        && !!exposureId
        && timestep !== undefined;

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

    useEffect(() => {
        if (!octree || !camera || !enabled) {
            managerRef.current = null;
            setSelection(null);
            return;
        }
        managerRef.current = new LODManager(octree, viewportRef.current, camera);
        setSelection(managerRef.current.selectLODTiles(settingsRef.current));
    }, [octree, camera, enabled]);

    useEffect(() => {
        const manager = managerRef.current;
        if (!manager || !camera) return;
        manager.setCamera(camera);
    }, [camera]);

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
