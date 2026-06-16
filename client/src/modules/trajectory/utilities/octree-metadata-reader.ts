import { createService, get } from '@/app/core/http/utilities/create-service';

import type { OctreeMetadata } from '@/modules/fractal/types/lod-config';

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

const cache = new Map<string, OctreeMetadata>();

const cacheKey = (input: GetOctreeMetadataInputDTO): string =>
    `${input.trajectoryId}:${input.analysisId}:${input.exposureId}:${input.timestep}`;

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
        return null;
    }
};

const isValidOctreeMetadata = (value: unknown): value is OctreeMetadata => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<OctreeMetadata>;
    return candidate.version === 1
        && Array.isArray(candidate.cells)
        && typeof candidate.maxDepth === 'number'
        && !!candidate.rootBounds;
};
