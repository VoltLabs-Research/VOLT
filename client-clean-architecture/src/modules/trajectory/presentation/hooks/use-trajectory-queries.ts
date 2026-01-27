import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trajectoryRepository } from '@/modules/trajectory/infrastructure/repositories/TrajectoryRepository';
import type { GetTrajectoriesParams } from '@/modules/trajectory/domain/repositories/ITrajectoryRepository';
import type { Trajectory } from '@/modules/trajectory/domain/entities';

export const trajectoryQueryKeys = {
    all: ['trajectories'] as const,
    lists: () => [...trajectoryQueryKeys.all, 'list'] as const,
    list: (params: any) => [...trajectoryQueryKeys.lists(), params] as const,
    details: () => [...trajectoryQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...trajectoryQueryKeys.details(), id] as const,
    metrics: () => [...trajectoryQueryKeys.all, 'metrics'] as const,
    atomsBase: () => [...trajectoryQueryKeys.all, 'atoms'] as const,
    atoms: (trajectoryId: string, analysisId: string, params: any) => 
        [...trajectoryQueryKeys.atomsBase(), trajectoryId, analysisId, params] as const,
    vfsBase: () => [...trajectoryQueryKeys.all, 'vfs'] as const,
    vfsList: (trajectoryId: string, path: string) => [...trajectoryQueryKeys.vfsBase(), 'list', trajectoryId, path] as const,
    vfsTrajectories: () => [...trajectoryQueryKeys.vfsBase(), 'trajectories'] as const,
};

export const useAtoms = (params: {
    trajectoryId: string;
    analysisId: string;
    timestep: number;
    exposureId: string;
    pageSize?: number;
}) => {
    const pageSize = params.pageSize ?? 50000;

    const query = useInfiniteQuery({
        queryKey: trajectoryQueryKeys.atoms(params.trajectoryId, params.analysisId, {
            timestep: params.timestep,
            exposureId: params.exposureId,
            pageSize
        }),
        queryFn: ({ pageParam }) =>
            trajectoryRepository.getAtoms(params.trajectoryId, params.analysisId, {
                timestep: params.timestep,
                exposureId: params.exposureId,
                page: pageParam as number,
                pageSize
            }) as Promise<{ data: any[]; properties: string[]; hasMore: boolean; total?: number }>,
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => lastPage.hasMore ? allPages.length + 1 : undefined,
        enabled: Boolean(params.trajectoryId && params.analysisId && params.timestep !== undefined && params.exposureId)
    });

    const pages = query.data?.pages ?? [];
    const rows = pages.flatMap((page) => page.data ?? []);
    const properties = pages[0]?.properties ?? [];

    return {
        ...query,
        rows,
        properties
    };
};

export const useTrajectories = (params: GetTrajectoriesParams = {}, options: any = {}) => {
    const query = useInfiniteQuery({
        queryKey: trajectoryQueryKeys.list(params),
        queryFn: ({ pageParam }) => 
            trajectoryRepository.getAllPaginated({ ...params, page: pageParam as number }),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => {
            const current = lastPage.page?.current ?? 1;
            const total = lastPage.page?.total ?? 0;
            return current < total ? current + 1 : undefined;
        },
        ...options
    });

    const pages = query.data?.pages ?? [];
    const trajectories = pages.flatMap((page) => page.data);

    return {
        ...query,
        trajectories
    };
};

export const useTrajectory = (id: string, include?: string, options: any = {}) => {
    return useQuery<Trajectory>({
        queryKey: trajectoryQueryKeys.detail(id),
        queryFn: () => trajectoryRepository.getById(id, include),
        enabled: Boolean(id),
        ...options
    });
};

export const useTrajectoryMetrics = () => {
    return useQuery({
        queryKey: trajectoryQueryKeys.metrics(),
        queryFn: () => trajectoryRepository.getMetrics()
    });
};

export const useTrajectoryVFS = (trajectoryId: string, path: string) => {
    return useQuery({
        queryKey: trajectoryQueryKeys.vfsList(trajectoryId, path),
        queryFn: () => trajectoryRepository.vfsList(trajectoryId, path),
        enabled: Boolean(trajectoryId)
    });
};

export const useTrajectoryVFSTrajectories = () => {
    return useQuery({
        queryKey: trajectoryQueryKeys.vfsTrajectories(),
        queryFn: () => trajectoryRepository.vfsGetTrajectories()
    });
};

export const useUploadTrajectory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ formData, onProgress }: { formData: FormData; onProgress?: (p: number) => void }) =>
            trajectoryRepository.create(formData, onProgress),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: trajectoryQueryKeys.lists() });
        }
    });
};

export const useUpdateTrajectory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) =>
            trajectoryRepository.update(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: trajectoryQueryKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: trajectoryQueryKeys.lists() });
        }
    });
};

export const useDeleteTrajectory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => trajectoryRepository.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: trajectoryQueryKeys.lists() });
        }
    });
};

export const useTrajectoryJobs = (trajectoryId: string) => {
    const queryClient = useQueryClient();
    
    const clearHistory = useMutation({
        mutationFn: () => trajectoryRepository.clearHistory(trajectoryId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['analysis', 'list', { trajectoryId }] });
        }
    });

    const removeRunningJobs = useMutation({
        mutationFn: () => trajectoryRepository.removeRunningJobs(trajectoryId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['analysis', 'list', { trajectoryId }] });
        }
    });

    const retryFailedJobs = useMutation({
        mutationFn: () => trajectoryRepository.retryFailedJobs(trajectoryId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['analysis', 'list', { trajectoryId }] });
        }
    });

    return {
        clearHistory,
        removeRunningJobs,
        retryFailedJobs
    };
};

export const useParticleFilterPreview = () => {
    return useMutation({
        mutationFn: (params: any) => trajectoryRepository.particleFilterPreview(params)
    });
};

export const useParticleFilterApply = () => {
    return useMutation({
        mutationFn: (params: any) => trajectoryRepository.particleFilterApplyAction(params)
    });
};

export const useParticleFilterProperties = (params: { trajectoryId: string; analysisId?: string; timestep: number }) => {
    return useQuery({
        queryKey: [...trajectoryQueryKeys.all, 'particle-filter', 'properties', params],
        queryFn: () => trajectoryRepository.particleFilterGetProperties(params.trajectoryId, params.analysisId, params.timestep),
        enabled: Boolean(params.trajectoryId && params.timestep !== undefined)
    });
};
