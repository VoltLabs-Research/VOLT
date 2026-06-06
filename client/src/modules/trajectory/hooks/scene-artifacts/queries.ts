import { useQueries } from '@tanstack/react-query';
import { buildKeys, createQuery } from '@/shared/infrastructure/query';
import { snapshotQueries } from '@/shared/infrastructure/query/cache-utils';
import queryClient from '@/shared/infrastructure/query/query-client';
import {
    currentCanvasDataAccess,
    currentAccessKey
} from '@/modules/canvas/api/access';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { QueryDataSnapshot } from '@/shared/infrastructure/query/cache-utils';
import type { SceneArtifact } from '../../api/entities/scene-artifacts/scene-artifact';
import type {
    ListSceneArtifactsInputDTO,
    RenderableExposurePayload
} from '../../api/services/scene-artifacts-service';

type SceneArtifactsPage = PaginatedResponse<SceneArtifact | RenderableExposurePayload>;

const BASE_KEY = 'trajectory';

const KEYS = buildKeys<{
    sceneArtifacts: ListSceneArtifactsInputDTO;
}>(BASE_KEY);

export const SCENE_ARTIFACTS_QUERY_KEYS = {
    sceneArtifacts: KEYS.sceneArtifacts
} as const;

const isSceneArtifactsQueryKey = (queryKey: readonly unknown[]): boolean => {
    return queryKey.some((entry) => entry === BASE_KEY)
        && queryKey.some((entry) => entry === 'sceneArtifacts');
};

const getSceneArtifactAnalysisId = (item: SceneArtifact | RenderableExposurePayload): string | undefined => {
    const candidate = item as unknown as Record<string, unknown>;

    if (typeof candidate.analysisId === 'string') {
        return candidate.analysisId;
    }

    const analysis = candidate.analysis;
    if (typeof analysis === 'string') {
        return analysis;
    }

    if (analysis && typeof analysis === 'object' && '_id' in analysis) {
        const analysisId = (analysis as { _id?: unknown })._id;
        return typeof analysisId === 'string' ? analysisId : undefined;
    }

    return undefined;
};

const removeAnalysisItemsFromSceneArtifactPage = (
    page: SceneArtifactsPage,
    analysisId: string
): SceneArtifactsPage => {
    const data = page.data.filter((item) => getSceneArtifactAnalysisId(item) !== analysisId);
    const removedCount = page.data.length - data.length;

    if (removedCount === 0) {
        return page;
    }

    const total = Math.max(0, page.pagination.total - removedCount);

    return {
        ...page,
        data,
        pagination: {
            ...page.pagination,
            total,
            totalPages: Math.ceil(total / page.pagination.limit)
        }
    };
};

const getSceneArtifactsKey = (params: ListSceneArtifactsInputDTO) =>
    currentAccessKey(KEYS.sceneArtifacts(params));

const fetchSceneArtifacts = (params: ListSceneArtifactsInputDTO): Promise<SceneArtifactsPage> => {
    return currentCanvasDataAccess().listSceneArtifacts(params);
};

export const sceneArtifactsQuery = createQuery(getSceneArtifactsKey, fetchSceneArtifacts);

// Why: the stored query key is prefixed by `withAccessMode` (canvas-access/<mode>/...)
// so invalidating with the bare `SCENE_ARTIFACTS_QUERY_KEYS.sceneArtifacts()` key
// fails the prefix match and nothing refetches.
export const invalidateSceneArtifacts = (): Promise<void> => {
    return queryClient.invalidateQueries({
        queryKey: currentAccessKey(SCENE_ARTIFACTS_QUERY_KEYS.sceneArtifacts())
    });
};

export const snapshotSceneArtifactCaches = (): QueryDataSnapshot => {
    return snapshotQueries((query) => Array.isArray(query.queryKey)
        && isSceneArtifactsQueryKey(query.queryKey));
};

export const cancelSceneArtifactCacheQueries = (): Promise<void> => {
    return queryClient.cancelQueries({
        predicate: (query) => Array.isArray(query.queryKey)
            && isSceneArtifactsQueryKey(query.queryKey)
    });
};

export const removeSceneArtifactsForAnalysisFromCache = (analysisId: string): void => {
    queryClient.setQueriesData<SceneArtifactsPage>(
        {
            predicate: (query) => Array.isArray(query.queryKey)
                && isSceneArtifactsQueryKey(query.queryKey)
        },
        (current) => {
            if (!current || !Array.isArray(current.data)) return current;
            return removeAnalysisItemsFromSceneArtifactPage(current, analysisId);
        }
    );
};

export const buildSceneArtifactsQueryOptions = sceneArtifactsQuery.buildOptions;

export const useSceneArtifactsQueries = (paramsList: ListSceneArtifactsInputDTO[]) => {
    return useQueries({
        queries: paramsList.map((params) => ({
            ...sceneArtifactsQuery.buildOptions(params),
            staleTime: 5 * 60 * 1000,
            enabled: Boolean(params.trajectoryId),
            retry: false
        }))
    });
};
