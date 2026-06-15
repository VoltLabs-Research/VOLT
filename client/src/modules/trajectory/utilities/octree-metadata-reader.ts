import { createService, get } from '@/app/core/http/utilities/create-service';

import type { OctreeMetadata } from '@/modules/fractal/types/lod-config';

// Octree-metadata reader: fetches and parses the LOD sidecar the daemon bakes
// next to a point-cloud GLB (`<glbKey>.octree.json`), served by the trajectory
// server's stream-lod route. The sidecar is the cell hierarchy + per-tier draw
// budgets the LOD manager reads to fetch only visible-region tiles — the
// streaming that earns VOLT's 100M-atom claim.
//
// Mirrors the line `.ranges.json` reader contract (line-style-service.getRanges):
// same RBAC team scope, same exposure identity (analysisId + exposureId +
// timestep). v1 serves one whole-cloud GLB with the octree as index ranges into
// it, so there are no per-cell GLB tiles to fetch yet.

export interface GetOctreeMetadataInputDTO {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
}

const endpoints = {
    get: get<GetOctreeMetadataInputDTO, OctreeMetadata>(
        ({ trajectoryId, analysisId, exposureId }) => `/${trajectoryId}/${analysisId}/${exposureId}/octree-metadata`,
        {
            query: ({ timestep }) => ({ timestep })
        }
    )
};

const octreeMetadataService = createService({
    clients: {
        default: {
            basePath: '/lod',
            useRBAC: true
        }
    }
}, endpoints);

// In-memory cache keyed by the exposure identity, so a camera move that re-asks
// for the same analysis's octree never refetches (the sidecar is immutable for a
// baked analysis). Matches the LOD plan T11 contract.
const cache = new Map<string, OctreeMetadata>();

const cacheKey = (input: GetOctreeMetadataInputDTO): string =>
    `${input.trajectoryId}:${input.analysisId}:${input.exposureId}:${input.timestep}`;

// Fetch + parse + cache the octree metadata for an exposure. Returns null when
// no sidecar exists (small clouds skip the octree bake below the daemon's atom
// threshold), so callers fall back to the Morton render path.
export const fetchOctreeMetadata = async (
    input: GetOctreeMetadataInputDTO
): Promise<OctreeMetadata | null> => {
    const key = cacheKey(input);
    const cached = cache.get(key);
    if (cached) return cached;

    try {
        const metadata = await octreeMetadataService.get(input);
        if (!isValidOctreeMetadata(metadata)) return null;
        cache.set(key, metadata);
        return metadata;
    } catch {
        // A 404 (no sidecar baked) or transport error is non-fatal: the caller
        // keeps the Morton fallback. Not cached, so a later retry can succeed.
        return null;
    }
};

// Structural guard: the sidecar comes from the daemon bake, but a stale or
// truncated object should degrade to "no LOD" rather than crash the manager.
const isValidOctreeMetadata = (value: unknown): value is OctreeMetadata => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<OctreeMetadata>;
    return candidate.version === 1
        && Array.isArray(candidate.cells)
        && typeof candidate.maxDepth === 'number'
        && !!candidate.rootBounds;
};
