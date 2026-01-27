import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared/types/api';
import type { AnalysisConfig, RetryFailedFramesResponse } from '@/modules/analysis/domain/entities';
import { analysisRepository } from '@/modules/analysis/infrastructure/repositories/AnalysisRepository';

export const analysisQueryKeys = {
    all: ['analysis-configs'] as const,
    byTeam: (teamId: string | null | undefined, search: string, limit: number) => [
        'analysis-configs',
        'team',
        teamId ?? 'none',
        search,
        limit
    ] as const,
    byTrajectory: (trajectoryId: string | null | undefined, limit: number) => [
        'analysis-configs',
        'trajectory',
        trajectoryId ?? 'none',
        limit
    ] as const
};

const getNextPage = (lastPage: PaginatedResponse<AnalysisConfig>, limit: number) => {
    const currentPage = lastPage.page?.current ?? 1;
    const totalPages = lastPage.page?.total ?? 0;
    if (totalPages && currentPage < totalPages) return currentPage + 1;
    if (lastPage.data.length >= limit) return currentPage + 1;
    return undefined;
};

export const useAnalysisConfigs = (params: {
    teamId: string | null | undefined;
    limit?: number;
    search?: string;
}) => {
    const limit = params.limit ?? 20;
    const search = params.search ?? '';

    const query = useInfiniteQuery<PaginatedResponse<AnalysisConfig>>({
        queryKey: analysisQueryKeys.byTeam(params.teamId ?? null, search, limit),
        queryFn: ({ pageParam }) =>
            analysisRepository.getByTeamId({ page: pageParam as number, limit, q: search }),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => getNextPage(lastPage, limit),
        enabled: Boolean(params.teamId),
        staleTime: 30_000
    });

    const pages = query.data?.pages ?? [];
    const analysisConfigs = pages.flatMap((page) => page.data);
    const lastPage = pages[pages.length - 1];
    const total = lastPage?.results?.total ?? analysisConfigs.length;
    const currentPage = (lastPage?.page?.current ?? pages.length) || 1;
    const listingMeta = {
        page: currentPage,
        limit,
        total,
        hasMore: Boolean(query.hasNextPage)
    };

    return {
        ...query,
        isLoading: query.isPending,
        analysisConfigs,
        listingMeta
    };
};

export const useAnalysisConfigsByTrajectory = (trajectoryId: string | null | undefined, limit = 100) => {
    return useQuery({
        queryKey: analysisQueryKeys.byTrajectory(trajectoryId ?? null, limit),
        queryFn: () => analysisRepository.getByTrajectoryId(trajectoryId as string, { limit }),
        enabled: Boolean(trajectoryId),
        staleTime: 30_000
    });
};

export const useDeleteAnalysisConfig = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => analysisRepository.deleteConfig(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: analysisQueryKeys.all });
        }
    });
};

export const useRetryFailedFrames = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string): Promise<RetryFailedFramesResponse> =>
            analysisRepository.retryFailedFrames(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: analysisQueryKeys.all });
        }
    });
};