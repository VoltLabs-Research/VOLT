import { useQueries } from '@tanstack/react-query';
import { buildKeys, createQuery } from '@/shared/query';
import { snapshotQueries } from '@/shared/query/cache-utils';
import queryClient from '@/shared/query/query-client';
import {
    currentCanvasDataAccess,
    currentAccessKey
} from '@/modules/canvas/api/access';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { QueryDataSnapshot } from '@/shared/query/cache-utils';
import type { SceneArtifact } from '@volt/contracts/modules/trajectory/domain';
import type {
    ListSceneArtifactsInput,
    RenderableExposurePayload
} from '../../api/services/scene-artifacts-service';

type SceneArtifactsPage = PaginatedResponse<SceneArtifact | RenderableExposurePayload>;

const BASE_KEY = 'trajectory';

const KEYS = buildKeys<{
    sceneArtifacts: ListSceneArtifactsInput;
}>(BASE_KEY);

const isSceneArtifactsQueryKey = (queryKey: readonly unknown[]): boolean => {
    return queryKey.some((entry) => entry === BASE_KEY)
        && queryKey.some((entry) => entry === 'sceneArtifacts');
};

const getSceneArtifactAnalysisId = (item: SceneArtifact | RenderableExposurePayload): string | undefined => {
    if ('exposureId' in item) {
        return item.analysisId;
    }

    const analysis = item.analysis;
    if (typeof analysis === 'string') {
        return analysis;
    }

    return analysis?._id;
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

const getSceneArtifactsKey = (params: ListSceneArtifactsInput) =>
    currentAccessKey(KEYS.sceneArtifacts(params));

const fetchSceneArtifacts = (params: ListSceneArtifactsInput): Promise<SceneArtifactsPage> => {
    return currentCanvasDataAccess().listSceneArtifacts(params);
};

export const sceneArtifactsQuery = createQuery(getSceneArtifactsKey, fetchSceneArtifacts);

export const invalidateSceneArtifacts = (): Promise<void> => {
    return queryClient.invalidateQueries({
        queryKey: currentAccessKey(KEYS.sceneArtifacts())
    });
};

export const snapshotSceneArtifactCaches = (): QueryDataSnapshot => {
    return snapshotQueries((query) => isSceneArtifactsQueryKey(query.queryKey));
};

export const cancelSceneArtifactCacheQueries = (): Promise<void> => {
    return queryClient.cancelQueries({
        predicate: (query) => isSceneArtifactsQueryKey(query.queryKey)
    });
};

export const removeSceneArtifactsForAnalysisFromCache = (analysisId: string): void => {
    queryClient.setQueriesData<SceneArtifactsPage>(
        {
            predicate: (query) => isSceneArtifactsQueryKey(query.queryKey)
        },
        (current) => {
            if (!current) return current;
            return removeAnalysisItemsFromSceneArtifactPage(current, analysisId);
        }
    );
};

export const buildSceneArtifactsQueryOptions = sceneArtifactsQuery.buildOptions;

export const useSceneArtifactsQueries = (paramsList: ListSceneArtifactsInput[]) => {
    return useQueries({
        queries: paramsList.map((params) => ({
            ...sceneArtifactsQuery.buildOptions(params),
            staleTime: 5 * 60 * 1000,
            enabled: Boolean(params.trajectoryId),
            retry: false
        }))
    });
};
