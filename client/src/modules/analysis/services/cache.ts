import {
    analysisQuery,
    isAnalysisByTrajectoryQueryKey,
    patchAnalysisByTrajectoryQueries,
    KEYS
} from '../hooks/queries';
import { removeEntityFromList, snapshotQueries } from '@/shared/query/cache-utils';
import queryClient from '@/shared/query/query-client';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type {
    AnalysisCreatedSocketPayload,
    AnalysisStageChangedSocketPayload,
    AnalysisStatusChangedSocketPayload
} from '@/modules/socket/events/analysis';
import type { QueryDataSnapshot } from '@/shared/query/cache-utils';

type PatchAnalysisStatusInput = Pick<
    AnalysisStatusChangedSocketPayload,
    'analysisId' | 'status' | 'totalFrames' | 'artifactStatus' | 'expectedArtifacts' | 'stages' | 'childAnalyses'
>;

type PatchAnalysisExecutionInput = Pick<
    AnalysisStageChangedSocketPayload,
    'analysisId' | 'artifactStatus' | 'expectedArtifacts' | 'stages' | 'childAnalyses'
>;

interface FindCachedAnalysisByIdInput {
    analysisId: string;
    trajectoryId?: string;
    fallbackAnalyses?: Analysis[];
};

// TanStack hands query keys back as `readonly unknown[]`, so the params object has to be narrowed.
const getQueryKeyTrajectoryId = (queryKey: readonly unknown[]): string | undefined => {
    const params = queryKey.find((entry): entry is { trajectoryId: string } => {
        return typeof entry === 'object'
            && entry !== null
            && typeof (entry as { trajectoryId?: unknown }).trajectoryId === 'string';
    });

    return params?.trajectoryId;
};

const isCanvasAnalysesQueryKey = (queryKey: readonly unknown[]): boolean => {
    return queryKey.includes('canvas') && queryKey.includes('analyses');
};

const isAnalysisCacheQueryKey = (queryKey: readonly unknown[]): boolean => {
    return isAnalysisByTrajectoryQueryKey(queryKey)
        || isCanvasAnalysesQueryKey(queryKey)
        || (queryKey.includes('analysis') && ['list', 'infinite-list', 'detail'].some((segment) => queryKey.includes(segment)));
};

const patchCanvasAnalysesQueries = (
    updater: (page: PaginatedResponse<Analysis>) => PaginatedResponse<Analysis>
): void => {
    queryClient.setQueriesData<PaginatedResponse<Analysis>>(
        {
            predicate: (query) => isCanvasAnalysesQueryKey(query.queryKey)
        },
        (current) => current ? updater(current) : current
    );
};

export const snapshotAnalysisCaches = (): QueryDataSnapshot => {
    return snapshotQueries((query) => isAnalysisCacheQueryKey(query.queryKey));
};

export const cancelAnalysisCacheQueries = (): Promise<void> => {
    return queryClient.cancelQueries({
        predicate: (query) => isAnalysisCacheQueryKey(query.queryKey)
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

    patchAnalysisByTrajectoryQueries(removeFromPage);
    patchCanvasAnalysesQueries(removeFromPage);
};

const upsertAnalysisCaches = (analysis: Analysis): void => {
    analysisQuery.cache.upsert(analysis);

    queryClient.getQueriesData<PaginatedResponse<Analysis>>({
        predicate: (query) => isAnalysisByTrajectoryQueryKey(query.queryKey)
    }).forEach(([queryKey, page]) => {
        if (!page) return;
        if (getQueryKeyTrajectoryId(queryKey) !== analysis.trajectory._id) return;

        const exists = page.data.some((a) => a._id === analysis._id);
        if (exists) {
            queryClient.setQueryData<PaginatedResponse<Analysis>>(queryKey, {
                ...page,
                data: page.data.map((a) => a._id === analysis._id ? {
                    ...a,
                    ...analysis
                } : a)
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

export const upsertAnalysisFromSocketPayload = (data: AnalysisCreatedSocketPayload, trajectoryName: string): void => {
    upsertAnalysisCaches({
        _id: data.analysisId,
        plugin: data.pluginId,
        pluginDisplayName: data.pluginDisplayName,
        config: data.config,
        trajectory: {
            _id: data.trajectoryId,
            name: trajectoryName
        },
        totalFrames: 0,
        status: data.status,
        artifactStatus: data.artifactStatus,
        expectedArtifacts: data.expectedArtifacts,
        createdAt: data.createdAt,
        updatedAt: data.createdAt
    });

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
        predicate: (query) => isAnalysisByTrajectoryQueryKey(query.queryKey)
    })) {
        if (trajectoryId && getQueryKeyTrajectoryId(queryKey) !== trajectoryId) {
            continue;
        }

        const match = page?.data.find((analysis) => analysis._id === analysisId);
        if (match) {
            return match;
        }
    }

    for (const [, page] of queryClient.getQueriesData<PaginatedResponse<Analysis>>({ queryKey: analysisQuery.QUERY_KEYS.lists() })) {
        const match = page?.data.find((analysis) => analysis._id === analysisId);
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
    const patchPage = (page: PaginatedResponse<Analysis>): PaginatedResponse<Analysis> => ({
        ...page,
        data: page.data.map(applyPatch)
    });

    queryClient.setQueryData<Analysis>(KEYS.detail(analysisId), (current) => {
        return current ? applyPatch(current) : current;
    });

    analysisQuery.cache.patchAllLists(patchPage);
    patchAnalysisByTrajectoryQueries(patchPage);
};

export const updateAnalysisStatusCaches = (patch: PatchAnalysisStatusInput): void => {
    patchAnalysisCaches(patch.analysisId, (analysis) => ({
        ...analysis,
        status: patch.status,
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
