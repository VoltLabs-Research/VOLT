import rasterService from '@/modules/raster/api/service';
import useTeamJobsStore from '@/modules/jobs/store/use-team-jobs-store';
import { TRAJECTORY_QUERY_KEYS } from '@/modules/trajectory/hooks/trajectory/queries';
import { buildKeys } from '@/shared/query/query-keys';
import { createQuery } from '@/shared/query/create-query';
import queryClient from '@/shared/query/query-client';
import { useMutation } from '@tanstack/react-query';
import { currentCanvasDataAccess, currentAccessKey } from '@/modules/canvas/api/access/use-canvas-access-store';
import type { GetRasterMetadataParams, TriggerRasterizationParams } from '@/modules/raster/api/service';
import type { TriggerRasterizationResponse } from '@volt/contracts/modules/raster/domain';

const KEYS = buildKeys<{
    metadata: GetRasterMetadataParams;
}>('raster');

const markRasterizationRequestPending = (trajectoryId: string): void => {
    const currentIds = useTeamJobsStore.getState().requestedRasterTrajectoryIds;
    if (currentIds.has(trajectoryId)) {
        throw new Error('Equivalent rasterization jobs are already queued or running for this trajectory');
    }

    const nextIds = new Set(currentIds);
    nextIds.add(trajectoryId);
    useTeamJobsStore.getState().setRequestedRasterTrajectoryIds(nextIds);
};

const clearRasterizationRequestPending = (trajectoryId: string): void => {
    const currentIds = useTeamJobsStore.getState().requestedRasterTrajectoryIds;
    if (!currentIds.has(trajectoryId)) {
        return;
    }

    const nextIds = new Set(currentIds);
    nextIds.delete(trajectoryId);
    useTeamJobsStore.getState().setRequestedRasterTrajectoryIds(nextIds);
};

export const rasterMetadataQuery = createQuery(
    (params: GetRasterMetadataParams) => currentAccessKey(KEYS.metadata(params)),
    (params: GetRasterMetadataParams) => currentCanvasDataAccess().getRasterMetadata(params)
);

export const useTriggerRasterizationMutation = () => {
    return useMutation<TriggerRasterizationResponse, Error, TriggerRasterizationParams>({
        mutationFn: async (variables) => {
            markRasterizationRequestPending(variables.trajectoryId);
            return rasterService.triggerRasterization(variables);
        },
        onSuccess: async (_data, variables) => {
            clearRasterizationRequestPending(variables.trajectoryId);

            await Promise.all([
                rasterMetadataQuery.invalidate({ trajectoryId: variables.trajectoryId }),
                queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.simulationGrid() }),
                queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.trajectories() }),
                queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.trajectory(variables.trajectoryId) })
            ]);
        },
        onError: (_error, variables) => {
            clearRasterizationRequestPending(variables.trajectoryId);
        }
    });
};
