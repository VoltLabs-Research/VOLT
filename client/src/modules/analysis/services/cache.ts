import { analysisQuery, KEYS } from '../hooks/queries';
import { patchPaginatedPage } from '@/shared/infrastructure/query/cache-utils';
import queryClient from '@/shared/infrastructure/query/query-client';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { Analysis } from '../api/entities/analysis';
import type { GetAnalysesByTrajectoryParams } from '../api/dtos/get-analyses-by-trajectory';

export interface PatchAnalysisStatusInput {
    analysisId: string;
    status: Analysis['status'];
    completedFrames?: number;
    totalFrames?: number;
};

interface FindCachedAnalysisByIdInput {
    analysisId: string;
    trajectoryId?: string;
    fallbackAnalyses?: Analysis[];
};

const getTrajectoryParams = (queryKey: readonly unknown[]): GetAnalysesByTrajectoryParams | undefined => {
    const candidate = queryKey[2] as Partial<GetAnalysesByTrajectoryParams> | undefined;

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

export const upsertAnalysisCaches = (analysis: Analysis): void => {
    analysisQuery.cache.upsert(analysis);

    const analysisTrajectoryId = analysis.trajectory?._id;

    queryClient.getQueriesData<PaginatedResponse<Analysis>>({
        queryKey: KEYS.byTrajectory()
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

    for (const [queryKey, page] of queryClient.getQueriesData<PaginatedResponse<Analysis>>({ queryKey: KEYS.byTrajectory() })) {
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

export const updateAnalysisStatusCaches = (patch: PatchAnalysisStatusInput): void => {
    const patchEntity = (a: Analysis): Analysis => {
        if (a._id !== patch.analysisId) return a;
        return {
            ...a,
            status: patch.status,
            completedFrames: patch.completedFrames ?? a.completedFrames,
            totalFrames: patch.totalFrames ?? a.totalFrames
        };
    };

    queryClient.setQueryData<Analysis>(KEYS.detail(patch.analysisId), (current) => {
        return current ? patchEntity(current) : current;
    });

    analysisQuery.cache.patchAllLists((current) => ({
        ...current,
        data: current.data.map(patchEntity)
    }));

    patchPaginatedPage<Analysis>(KEYS.byTrajectory(), (page) => ({
        ...page,
        data: page.data.map(patchEntity)
    }));
};
