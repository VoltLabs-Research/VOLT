import { analysisQuery, KEYS } from '../hooks/queries';
import { patchPaginatedPage, removeEntityFromList, snapshotQueries } from '@/shared/infrastructure/query/cache-utils';
import queryClient from '@/shared/infrastructure/query/query-client';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { Analysis } from '../api/entities/analysis';
import type { GetAnalysesByTrajectoryParams } from '../api/service';
import type { QueryDataSnapshot } from '@/shared/infrastructure/query/cache-utils';

export interface PatchAnalysisStatusInput {
    analysisId: string;
    status: Analysis['status'];
    completedFrames?: number;
    totalFrames?: number;
    artifactStatus?: Analysis['artifactStatus'];
    expectedArtifacts?: Analysis['expectedArtifacts'];
    stages?: Analysis['stages'];
    childAnalyses?: Analysis['childAnalyses'];
};

export interface PatchAnalysisExecutionInput {
    analysisId: string;
    artifactStatus?: Analysis['artifactStatus'];
    expectedArtifacts?: Analysis['expectedArtifacts'];
    stages?: Analysis['stages'];
    childAnalyses?: Analysis['childAnalyses'];
};

interface FindCachedAnalysisByIdInput {
    analysisId: string;
    trajectoryId?: string;
    fallbackAnalyses?: Analysis[];
};

const getTrajectoryParams = (queryKey: readonly unknown[]): GetAnalysesByTrajectoryParams | undefined => {
    const candidate = queryKey.find((entry): entry is Partial<GetAnalysesByTrajectoryParams> => {
        return typeof entry === 'object'
            && entry !== null
            && typeof (entry as Partial<GetAnalysesByTrajectoryParams>).trajectoryId === 'string';
    });

    if (typeof candidate?.trajectoryId !== 'string'
        || typeof candidate.page !== 'number'
        || typeof candidate.limit !== 'number') {
        return undefined;
    }

    return {
        trajectoryId: candidate.trajectoryId,
        page: candidate.page,
        limit: candidate.limit
    };
};

const isAnalysisByTrajectoryQueryKey = (queryKey: readonly unknown[]): boolean => {
    return queryKey.some((entry) => entry === 'analysis')
        && queryKey.some((entry) => entry === 'byTrajectory');
};

const isCanvasAnalysesQueryKey = (queryKey: readonly unknown[]): boolean => {
    return queryKey.some((entry) => entry === 'canvas')
        && queryKey.some((entry) => entry === 'analyses');
};

const isAnalysisListQueryKey = (queryKey: readonly unknown[]): boolean => {
    return queryKey.some((entry) => entry === 'analysis')
        && (
            queryKey.some((entry) => entry === 'list')
            || queryKey.some((entry) => entry === 'infinite-list')
            || queryKey.some((entry) => entry === 'detail')
        );
};

const isAnalysisCacheQueryKey = (queryKey: readonly unknown[]): boolean => {
    return isAnalysisByTrajectoryQueryKey(queryKey)
        || isAnalysisListQueryKey(queryKey)
        || isCanvasAnalysesQueryKey(queryKey);
};

const patchByTrajectoryQueries = (
    updater: (page: PaginatedResponse<Analysis>) => PaginatedResponse<Analysis>
): void => {
    queryClient.setQueriesData<PaginatedResponse<Analysis>>(
        {
            predicate: (query) => Array.isArray(query.queryKey)
                && isAnalysisByTrajectoryQueryKey(query.queryKey)
        },
        (current) => {
            if (!current || !Array.isArray(current.data)) return current;
            return updater(current);
        }
    );
};

const patchCanvasAnalysesQueries = (
    updater: (page: PaginatedResponse<Analysis>) => PaginatedResponse<Analysis>
): void => {
    queryClient.setQueriesData<PaginatedResponse<Analysis>>(
        {
            predicate: (query) => Array.isArray(query.queryKey)
                && isCanvasAnalysesQueryKey(query.queryKey)
        },
        (current) => {
            if (!current || !Array.isArray(current.data)) return current;
            return updater(current);
        }
    );
};

export const snapshotAnalysisCaches = (): QueryDataSnapshot => {
    return snapshotQueries((query) => Array.isArray(query.queryKey)
        && isAnalysisCacheQueryKey(query.queryKey));
};

export const cancelAnalysisCacheQueries = (): Promise<void> => {
    return queryClient.cancelQueries({
        predicate: (query) => Array.isArray(query.queryKey)
            && isAnalysisCacheQueryKey(query.queryKey)
    });
};

export const removeAnalysisCaches = (analysisId: string): void => {
    const removeFromPage = (page: PaginatedResponse<Analysis>) => removeEntityFromList(page, analysisId);

    queryClient.removeQueries({ queryKey: KEYS.detail(analysisId) });

    analysisQuery.cache.patchAllLists(removeFromPage);
    analysisQuery.cache.patchAllInfiniteLists((current) => ({
        ...current,
        pages: current.pages.map(removeFromPage),
        pageParams: current.pageParams
    }));

    patchPaginatedPage<Analysis>(KEYS.byTrajectory(), removeFromPage);
    patchByTrajectoryQueries(removeFromPage);
    patchCanvasAnalysesQueries(removeFromPage);
};

export const upsertAnalysisCaches = (analysis: Analysis): void => {
    analysisQuery.cache.upsert(analysis);

    const analysisTrajectoryId = analysis.trajectory?._id;

    queryClient.getQueriesData<PaginatedResponse<Analysis>>({
        predicate: (query) => Array.isArray(query.queryKey)
            && isAnalysisByTrajectoryQueryKey(query.queryKey)
    }).forEach(([queryKey, page]) => {
        if (!page) return;
        const params = getTrajectoryParams(queryKey);
        if (params?.trajectoryId !== analysisTrajectoryId) return;

        const exists = page.data.some((a) => a._id === analysis._id);
        if (exists) {
            queryClient.setQueryData<PaginatedResponse<Analysis>>(queryKey, {
                ...page,
                data: page.data.map((a) => a._id === analysis._id ? { ...a, ...analysis } : a)
            });
            return;
        }

        const isFirstPage = (page.pagination?.page ?? 1) === 1;
        if (!isFirstPage) return;

        queryClient.setQueryData<PaginatedResponse<Analysis>>(queryKey, {
            ...page,
            data: [analysis, ...page.data].slice(0, page.pagination.limit),
            pagination: {
                ...page.pagination,
                total: page.pagination.total + 1,
                totalPages: Math.ceil((page.pagination.total + 1) / page.pagination.limit)
            }
        });
    });
};

export const upsertAnalysisFromSocketPayload = (data: Record<string, unknown>, trajectoryName = ''): void => {
    const trajectoryId = String(data.trajectoryId || '');
    if (!trajectoryId) {
        return;
    }

    const newAnalysis = {
        _id: data.analysisId,
        plugin: data.pluginId,
        pluginDisplayName: data.pluginDisplayName,
        config: data.config,
        trajectory: { _id: trajectoryId, name: trajectoryName },
        totalFrames: data.totalFrames,
        completedFrames: data.completedFrames,
        status: data.status,
        artifactStatus: data.artifactStatus,
        expectedArtifacts: data.expectedArtifacts,
        stages: data.stages,
        childAnalyses: data.childAnalyses,
        createdAt: data.createdAt,
        updatedAt: data.createdAt
    } as unknown as Analysis;

    upsertAnalysisCaches(newAnalysis);
    void analysisQuery.cache.invalidate();
};

export const findCachedAnalysisById = ({ analysisId, trajectoryId, fallbackAnalyses = [] }: FindCachedAnalysisByIdInput): Analysis | undefined => {
    const fallbackMatch = fallbackAnalyses.find((analysis) => analysis._id === analysisId);
    if (fallbackMatch) {
        return fallbackMatch;
    }

    const detailMatch = queryClient.getQueryData<Analysis>(KEYS.detail(analysisId));
    if (detailMatch) {
        return detailMatch;
    }

    for (const [queryKey, page] of queryClient.getQueriesData<PaginatedResponse<Analysis>>({
        predicate: (query) => Array.isArray(query.queryKey)
            && isAnalysisByTrajectoryQueryKey(query.queryKey)
    })) {
        if (!page?.data?.length) {
            continue;
        }

        const params = getTrajectoryParams(queryKey);
        if (trajectoryId && params?.trajectoryId !== trajectoryId) {
            continue;
        }

        const match = page.data.find((analysis) => analysis._id === analysisId);
        if (match) {
            return match;
        }
    }

    for (const [, page] of queryClient.getQueriesData<PaginatedResponse<Analysis>>({ queryKey: analysisQuery.QUERY_KEYS.lists() })) {
        const match = page?.data?.find((analysis) => analysis._id === analysisId);
        if (match) {
            return match;
        }
    }

    return undefined;
};

const patchAnalysisCaches = (
    analysisId: string,
    patchEntity: (analysis: Analysis) => Analysis
): void => {
    const applyPatch = (analysis: Analysis): Analysis => {
        return analysis._id === analysisId ? patchEntity(analysis) : analysis;
    };

    queryClient.setQueryData<Analysis>(KEYS.detail(analysisId), (current) => {
        return current ? applyPatch(current) : current;
    });

    analysisQuery.cache.patchAllLists((current) => ({
        ...current,
        data: current.data.map(applyPatch)
    }));

    patchPaginatedPage<Analysis>(KEYS.byTrajectory(), (page) => ({
        ...page,
        data: page.data.map(applyPatch)
    }));
    patchByTrajectoryQueries((page) => ({
        ...page,
        data: page.data.map(applyPatch)
    }));
};

export const updateAnalysisStatusCaches = (patch: PatchAnalysisStatusInput): void => {
    patchAnalysisCaches(patch.analysisId, (analysis) => ({
        ...analysis,
        status: patch.status,
        completedFrames: patch.completedFrames ?? analysis.completedFrames,
        totalFrames: patch.totalFrames ?? analysis.totalFrames,
        artifactStatus: patch.artifactStatus ?? analysis.artifactStatus,
        expectedArtifacts: patch.expectedArtifacts ?? analysis.expectedArtifacts,
        stages: patch.stages ?? analysis.stages,
        childAnalyses: patch.childAnalyses ?? analysis.childAnalyses
    }));
};

export const updateAnalysisExecutionCaches = (patch: PatchAnalysisExecutionInput): void => {
    patchAnalysisCaches(patch.analysisId, (analysis) => ({
        ...analysis,
        artifactStatus: patch.artifactStatus ?? analysis.artifactStatus,
        expectedArtifacts: patch.expectedArtifacts ?? analysis.expectedArtifacts,
        stages: patch.stages ?? analysis.stages,
        childAnalyses: patch.childAnalyses ?? analysis.childAnalyses
    }));
};
